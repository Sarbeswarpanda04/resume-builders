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

    photo = data.get("photo", "") or ""
    if photo and not re.match(r"^data:image/(jpeg|png|webp);base64,", photo):
        photo = ""
    if len(photo) > 4_000_000:
        photo = ""

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
        "photo":         photo,
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

# ---------- hardcoded AI suggestions ----------

_ROLE_DATA = {
    "frontend": {
        "languages": ["JavaScript", "TypeScript", "HTML", "CSS"],
        "tools": ["VS Code", "Git", "Webpack", "npm", "Figma"],
        "technologies": ["React", "Vue.js", "Tailwind CSS", "REST APIs"],
        "summary": "Creative Frontend Developer skilled in building responsive, high-performance web interfaces using React and modern CSS frameworks. Passionate about clean code and great user experiences.",
    },
    "backend": {
        "languages": ["Python", "Java", "Node.js", "SQL"],
        "tools": ["Git", "Docker", "Postman", "Linux", "VS Code"],
        "technologies": ["Flask", "Django", "Express.js", "PostgreSQL", "Redis"],
        "summary": "Backend Developer with strong expertise in designing scalable APIs and database architectures. Experienced in Python and Node.js ecosystems with a focus on performance and reliability.",
    },
    "fullstack": {
        "languages": ["JavaScript", "TypeScript", "Python", "SQL"],
        "tools": ["Git", "Docker", "VS Code", "Postman", "npm"],
        "technologies": ["React", "Node.js", "Express.js", "MongoDB", "PostgreSQL"],
        "summary": "Full Stack Developer proficient in both frontend and backend development. Builds end-to-end web applications using the MERN stack with a focus on clean architecture and seamless user experiences.",
    },
    "data scientist": {
        "languages": ["Python", "R", "SQL"],
        "tools": ["Jupyter", "Git", "Tableau", "Excel", "VS Code"],
        "technologies": ["TensorFlow", "Pandas", "Scikit-learn", "NumPy", "Matplotlib"],
        "summary": "Data Scientist with expertise in machine learning, statistical analysis, and data visualization. Transforms complex datasets into actionable insights to drive business decisions.",
    },
    "machine learning": {
        "languages": ["Python", "R", "SQL"],
        "tools": ["Jupyter", "Git", "Docker", "MLflow"],
        "technologies": ["TensorFlow", "PyTorch", "Scikit-learn", "Keras", "OpenCV"],
        "summary": "Machine Learning Engineer experienced in designing and deploying ML models at scale. Proficient in deep learning frameworks and MLOps pipelines for production-grade AI solutions.",
    },
    "devops": {
        "languages": ["Python", "Bash", "YAML"],
        "tools": ["Docker", "Kubernetes", "Jenkins", "Git", "Terraform"],
        "technologies": ["AWS", "CI/CD", "Ansible", "Nginx", "Linux"],
        "summary": "DevOps Engineer specializing in automating CI/CD pipelines and managing cloud infrastructure. Proven ability to improve deployment frequency and system reliability through IaC and containerization.",
    },
    "android": {
        "languages": ["Kotlin", "Java", "XML"],
        "tools": ["Android Studio", "Git", "Gradle", "Firebase"],
        "technologies": ["Jetpack Compose", "Room DB", "Retrofit", "MVVM", "REST APIs"],
        "summary": "Android Developer with hands-on experience building intuitive mobile applications using Kotlin and Jetpack components. Focused on delivering polished, high-performance apps on the Android platform.",
    },
    "ios": {
        "languages": ["Swift", "Objective-C"],
        "tools": ["Xcode", "Git", "TestFlight", "CocoaPods"],
        "technologies": ["SwiftUI", "UIKit", "Core Data", "REST APIs", "Firebase"],
        "summary": "iOS Developer experienced in crafting elegant, user-friendly iPhone and iPad applications using Swift and SwiftUI. Committed to Apple's design guidelines and App Store best practices.",
    },
    "cybersecurity": {
        "languages": ["Python", "Bash", "C"],
        "tools": ["Wireshark", "Metasploit", "Nmap", "Burp Suite", "Git"],
        "technologies": ["Penetration Testing", "SIEM", "Firewalls", "Linux", "Cryptography"],
        "summary": "Cybersecurity Analyst skilled in threat detection, vulnerability assessment, and incident response. Dedicated to securing systems and data against evolving cyber threats.",
    },
    "ui ux": {
        "languages": ["HTML", "CSS", "JavaScript"],
        "tools": ["Figma", "Adobe XD", "Sketch", "Zeplin", "InVision"],
        "technologies": ["Prototyping", "Wireframing", "Design Systems", "User Research"],
        "summary": "UI/UX Designer with a passion for creating intuitive and visually appealing digital experiences. Expert in user-centered design principles, prototyping, and translating business goals into elegant interfaces.",
    },
    "cloud": {
        "languages": ["Python", "Bash", "YAML"],
        "tools": ["Terraform", "Docker", "Git", "AWS CLI", "Kubernetes"],
        "technologies": ["AWS", "Azure", "GCP", "Serverless", "Microservices"],
        "summary": "Cloud Engineer with expertise in designing and managing scalable cloud infrastructure on AWS and Azure. Skilled in automating deployments and optimizing costs through cloud-native solutions.",
    },
    "software engineer": {
        "languages": ["Python", "Java", "JavaScript", "C++"],
        "tools": ["Git", "Docker", "Jira", "VS Code", "Linux"],
        "technologies": ["REST APIs", "Microservices", "CI/CD", "SQL", "Agile"],
        "summary": "Software Engineer with a strong foundation in computer science and hands-on experience building reliable, scalable software solutions. Adept at working across the full development lifecycle in Agile teams.",
    },
}

def _find_role(role):
    role_lower = role.lower().strip()
    # exact match
    if role_lower in _ROLE_DATA:
        return _ROLE_DATA[role_lower]
    # partial match
    for key, val in _ROLE_DATA.items():
        if key in role_lower or role_lower in key:
            return val
    return None


@app.route("/api/ai_suggest", methods=["POST"])
def ai_suggest():
    body = request.get_json(silent=True) or {}
    role = str(body.get("role", "")).strip()[:200]
    if not role:
        abort(400, "role is required")
    result = _find_role(role)
    if not result:
        result = {
            "languages": ["Python", "JavaScript", "SQL"],
            "tools": ["Git", "VS Code", "Docker"],
            "technologies": ["REST APIs", "Linux", "Agile"],
            "summary": f"Dedicated {role} professional with a passion for solving complex problems and delivering high-quality results. Strong communicator and team player with hands-on technical experience.",
        }
    return jsonify(result)


@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": str(e.description)}), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": str(e.description)}), 404


@app.errorhandler(502)
def bad_gateway(e):
    return jsonify({"error": str(e.description)}), 502


if __name__ == "__main__":
    app.run(debug=True)
