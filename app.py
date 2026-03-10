import json
import os
import re
import threading
from flask import Flask, request, jsonify, render_template, abort

app = Flask(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "database", "resumes.json")
_db_lock = threading.Lock()


# ---------- helpers ----------

def _load_db():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_db(db):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)


def _next_id(resumes):
    if not resumes:
        return 1
    return max(r["id"] for r in resumes) + 1


def _sanitize_str(value, max_len=500):
    """Strip leading/trailing whitespace and cap length."""
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def _sanitize_resume(data):
    """Validate and sanitize all fields coming from the client."""
    if not isinstance(data, dict):
        return None

    def s(key, max_len=200):
        return _sanitize_str(data.get(key, ""), max_len)

    def s_list(key):
        val = data.get(key, [])
        if not isinstance(val, list):
            return []
        return [_sanitize_str(str(item)) for item in val[:50]]

    def s_list_of_dicts(key, allowed_keys):
        val = data.get(key, [])
        if not isinstance(val, list):
            return []
        result = []
        for item in val[:20]:
            if not isinstance(item, dict):
                continue
            result.append({k: _sanitize_str(str(item.get(k, ""))) for k in allowed_keys})
        return result

    email = s("email")
    # basic email format check
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        email = ""

    return {
        "name":        s("name"),
        "email":       email,
        "phone":       s("phone", 30),
        "address":     s("address"),
        "linkedin":    s("linkedin"),
        "github":      s("github"),
        "portfolio":   s("portfolio"),
        "summary":     s("summary", 1000),
        "education":   s_list_of_dicts("education",
                           ["degree", "college", "year", "grade"]),
        "experience":  s_list_of_dicts("experience",
                           ["company", "role", "duration", "description"]),
        "skills": {
            "languages":    s_list("skills.languages") if isinstance(data.get("skills"), list)
                            else ([_sanitize_str(str(x)) for x in data.get("skills", {}).get("languages", [])[:50]]
                                  if isinstance(data.get("skills"), dict) else []),
            "tools":        [_sanitize_str(str(x)) for x in data.get("skills", {}).get("tools", [])[:50]]
                            if isinstance(data.get("skills"), dict) else [],
            "technologies": [_sanitize_str(str(x)) for x in data.get("skills", {}).get("technologies", [])[:50]]
                            if isinstance(data.get("skills"), dict) else [],
        },
        "projects":      s_list_of_dicts("projects",
                             ["name", "description", "technologies", "github"]),
        "certifications": s_list("certifications"),
        "languages":     s_list("languages"),
    }


# ---------- pages ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/preview/<int:resume_id>")
def preview_page(resume_id):
    return render_template("preview.html", resume_id=resume_id)


# ---------- API ----------

@app.route("/save_resume", methods=["POST"])
def save_resume():
    data = request.get_json(silent=True)
    if not data:
        abort(400, "Invalid JSON payload")
    clean = _sanitize_resume(data)
    if clean is None:
        abort(400, "Invalid resume data")
    if not clean["name"]:
        abort(400, "Name is required")

    with _db_lock:
        db = _load_db()
        clean["id"] = _next_id(db["resumes"])
        db["resumes"].append(clean)
        _save_db(db)

    return jsonify({"status": "success", "id": clean["id"]}), 201


@app.route("/resumes", methods=["GET"])
def get_resumes():
    with _db_lock:
        db = _load_db()
    return jsonify(db["resumes"])


@app.route("/resume/<int:resume_id>", methods=["GET"])
def get_resume(resume_id):
    with _db_lock:
        db = _load_db()
    resume = next((r for r in db["resumes"] if r["id"] == resume_id), None)
    if resume is None:
        abort(404, "Resume not found")
    return jsonify(resume)


@app.route("/update/<int:resume_id>", methods=["PUT"])
def update_resume(resume_id):
    data = request.get_json(silent=True)
    if not data:
        abort(400, "Invalid JSON payload")
    clean = _sanitize_resume(data)
    if clean is None:
        abort(400, "Invalid resume data")
    if not clean["name"]:
        abort(400, "Name is required")

    with _db_lock:
        db = _load_db()
        for i, r in enumerate(db["resumes"]):
            if r["id"] == resume_id:
                clean["id"] = resume_id
                db["resumes"][i] = clean
                _save_db(db)
                return jsonify({"status": "updated", "id": resume_id})
    abort(404, "Resume not found")


@app.route("/delete/<int:resume_id>", methods=["DELETE"])
def delete_resume(resume_id):
    with _db_lock:
        db = _load_db()
        original_len = len(db["resumes"])
        db["resumes"] = [r for r in db["resumes"] if r["id"] != resume_id]
        if len(db["resumes"]) == original_len:
            abort(404, "Resume not found")
        _save_db(db)
    return jsonify({"status": "deleted"})


# ---------- error handlers ----------

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": str(e.description)}), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": str(e.description)}), 404


if __name__ == "__main__":
    app.run(debug=True)
