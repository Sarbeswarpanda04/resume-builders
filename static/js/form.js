/**
 * form.js — Smart Resume Builder
 * Handles: form state, tag inputs, repeatable sections,
 *          live preview wiring, auto-save, resume score,
 *          template switching, dark mode, AI suggestions,
 *          save/update via fetch, edit mode loading.
 */

// ─── State ───────────────────────────────────────────────
const state = {
  skills: { languages: [], tools: [], technologies: [] },
  certifications: [],
  languages: [],
  educationCount: 0,
  experienceCount: 0,
  projectCount: 0,
  editId: null,
  photo: null,
  currentTemplate: localStorage.getItem('selectedTemplate') || 'template1',
};

// ─── Utilities ───────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function val(id) { return (document.getElementById(id)?.value || '').trim(); }
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ─── Tag Input ────────────────────────────────────────────
function setupTagInput(inputId, tagsId, stateKey, parentKey) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(tagsId);
  if (!input || !container) return;

  function getArr() {
    return parentKey ? state[parentKey][stateKey] : state[stateKey];
  }
  function setArr(arr) {
    if (parentKey) state[parentKey][stateKey] = arr;
    else state[stateKey] = arr;
  }

  function render() {
    const arr = getArr();
    container.innerHTML = arr.map((item, i) => `
      <span class="tag-item">
        ${esc(item)}
        <span class="tag-remove" data-index="${i}" title="Remove">✕</span>
      </span>
    `).join('');
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const arr2 = getArr();
        arr2.splice(parseInt(btn.dataset.index), 1);
        setArr(arr2);
        render();
        triggerPreviewUpdate();
        computeScore();
        scheduleAutoSave();
      });
    });
  }

  function addTag() {
    const v = input.value.trim();
    if (!v) return;
    const arr = getArr();
    if (!arr.includes(v) && arr.length < 50) {
      arr.push(v);
      setArr(arr);
      input.value = '';
      render();
      triggerPreviewUpdate();
      computeScore();
      scheduleAutoSave();
    }
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  });
  input.addEventListener('blur', addTag);
  render();
}

// ─── Repeatable Sections ─────────────────────────────────
function makeEducationCard(idx) {
  const card = document.createElement('div');
  card.className = 'repeatable-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <button type="button" class="remove-btn" title="Remove"><i class="fas fa-times"></i></button>
    <div class="form-grid">
      <div class="form-group"><label>Degree</label>
        <input type="text" id="edu-degree-${idx}" placeholder="B.Sc. Computer Science" maxlength="150" /></div>
      <div class="form-group"><label>College / University</label>
        <input type="text" id="edu-college-${idx}" placeholder="MIT" maxlength="200" /></div>
      <div class="form-group"><label>Year</label>
        <input type="text" id="edu-year-${idx}" placeholder="2020–2024" maxlength="30" /></div>
      <div class="form-group"><label>CGPA / Percentage</label>
        <input type="text" id="edu-grade-${idx}" placeholder="8.5 / 10 or 85%" maxlength="30" /></div>
    </div>`;
  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove(); triggerPreviewUpdate(); computeScore();
  });
  ['degree','college','year','grade'].forEach(f => {
    document.getElementById(`edu-${f}-${idx}`)?.addEventListener('input', () => { triggerPreviewUpdate(); computeScore(); });
  });
  return card;
}

function makeExperienceCard(idx) {
  const card = document.createElement('div');
  card.className = 'repeatable-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <button type="button" class="remove-btn" title="Remove"><i class="fas fa-times"></i></button>
    <div class="form-grid">
      <div class="form-group"><label>Company Name</label>
        <input type="text" id="exp-company-${idx}" placeholder="Google" maxlength="150" /></div>
      <div class="form-group"><label>Role / Title</label>
        <input type="text" id="exp-role-${idx}" placeholder="Software Engineer" maxlength="150" /></div>
      <div class="form-group"><label>Duration</label>
        <input type="text" id="exp-duration-${idx}" placeholder="Jan 2022 – Present" maxlength="80" /></div>
      <div class="form-group full-width"><label>Description</label>
        <textarea id="exp-desc-${idx}" rows="3" placeholder="Key responsibilities and achievements..." maxlength="500"></textarea></div>
    </div>`;
  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove(); triggerPreviewUpdate(); computeScore();
  });
  ['company','role','duration','desc'].forEach(f => {
    document.getElementById(`exp-${f}-${idx}`)?.addEventListener('input', () => { triggerPreviewUpdate(); computeScore(); });
  });
  return card;
}

function makeProjectCard(idx) {
  const card = document.createElement('div');
  card.className = 'repeatable-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <button type="button" class="remove-btn" title="Remove"><i class="fas fa-times"></i></button>
    <div class="form-grid">
      <div class="form-group"><label>Project Name</label>
        <input type="text" id="proj-name-${idx}" placeholder="Portfolio Website" maxlength="150" /></div>
      <div class="form-group"><label>Technologies Used</label>
        <input type="text" id="proj-tech-${idx}" placeholder="React, Node.js" maxlength="200" /></div>
      <div class="form-group full-width"><label>Description</label>
        <textarea id="proj-desc-${idx}" rows="2" placeholder="Brief project description..." maxlength="400"></textarea></div>
      <div class="form-group full-width"><label>GitHub Link</label>
        <input type="text" id="proj-github-${idx}" placeholder="github.com/user/project" maxlength="200" /></div>
    </div>`;
  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove(); triggerPreviewUpdate(); computeScore();
  });
  ['name','tech','desc','github'].forEach(f => {
    document.getElementById(`proj-${f}-${idx}`)?.addEventListener('input', () => { triggerPreviewUpdate(); computeScore(); });
  });
  return card;
}

function addEducation(data = null) {
  const idx = ++state.educationCount;
  const container = document.getElementById('education-container');
  const card = makeEducationCard(idx);
  container.appendChild(card);
  if (data) {
    document.getElementById(`edu-degree-${idx}`).value  = data.degree  || '';
    document.getElementById(`edu-college-${idx}`).value = data.college || '';
    document.getElementById(`edu-year-${idx}`).value    = data.year    || '';
    document.getElementById(`edu-grade-${idx}`).value   = data.grade   || '';
  }
}

function addExperience(data = null) {
  const idx = ++state.experienceCount;
  const container = document.getElementById('experience-container');
  const card = makeExperienceCard(idx);
  container.appendChild(card);
  if (data) {
    document.getElementById(`exp-company-${idx}`).value  = data.company     || '';
    document.getElementById(`exp-role-${idx}`).value     = data.role        || '';
    document.getElementById(`exp-duration-${idx}`).value = data.duration    || '';
    document.getElementById(`exp-desc-${idx}`).value     = data.description || '';
  }
}

function addProject(data = null) {
  const idx = ++state.projectCount;
  const container = document.getElementById('projects-container');
  const card = makeProjectCard(idx);
  container.appendChild(card);
  if (data) {
    document.getElementById(`proj-name-${idx}`).value   = data.name         || '';
    document.getElementById(`proj-tech-${idx}`).value   = data.technologies || '';
    document.getElementById(`proj-desc-${idx}`).value   = data.description  || '';
    document.getElementById(`proj-github-${idx}`).value = data.github       || '';
  }
}

// ─── Collect Form Data ────────────────────────────────────
function collectFormData() {
  // Education
  const education = [];
  document.querySelectorAll('#education-container .repeatable-card').forEach(card => {
    const i = card.dataset.idx;
    education.push({
      degree:  document.getElementById(`edu-degree-${i}`)?.value.trim()  || '',
      college: document.getElementById(`edu-college-${i}`)?.value.trim() || '',
      year:    document.getElementById(`edu-year-${i}`)?.value.trim()    || '',
      grade:   document.getElementById(`edu-grade-${i}`)?.value.trim()   || '',
    });
  });

  // Experience
  const experience = [];
  document.querySelectorAll('#experience-container .repeatable-card').forEach(card => {
    const i = card.dataset.idx;
    experience.push({
      company:     document.getElementById(`exp-company-${i}`)?.value.trim()  || '',
      role:        document.getElementById(`exp-role-${i}`)?.value.trim()     || '',
      duration:    document.getElementById(`exp-duration-${i}`)?.value.trim() || '',
      description: document.getElementById(`exp-desc-${i}`)?.value.trim()    || '',
    });
  });

  // Projects
  const projects = [];
  document.querySelectorAll('#projects-container .repeatable-card').forEach(card => {
    const i = card.dataset.idx;
    projects.push({
      name:         document.getElementById(`proj-name-${i}`)?.value.trim()   || '',
      technologies: document.getElementById(`proj-tech-${i}`)?.value.trim()   || '',
      description:  document.getElementById(`proj-desc-${i}`)?.value.trim()  || '',
      github:       document.getElementById(`proj-github-${i}`)?.value.trim() || '',
    });
  });

  return {
    name:           val('name'),
    email:          val('email'),
    phone:          val('phone'),
    address:        val('address'),
    linkedin:       val('linkedin'),
    github:         val('github'),
    portfolio:      val('portfolio'),
    photo:          state.photo,
    summary:        val('summary'),
    education,
    experience,
    skills:         { ...state.skills },
    projects,
    certifications: [...state.certifications],
    languages:      [...state.languages],
  };
}

// ─── Resume Score ─────────────────────────────────────────
function computeScore() {
  const data = collectFormData();
  let score = 0;
  if (data.name)    score += 15;
  if (data.email)   score += 10;
  if (data.phone)   score += 5;
  if (data.summary) score += 15;
  if (data.education.some(e => e.degree))    score += 10;
  if (data.experience.some(e => e.company))  score += 15;
  const totalSkills = data.skills.languages.length + data.skills.tools.length + data.skills.technologies.length;
  if (totalSkills >= 3) score += 10;
  if (totalSkills >= 8) score += 5;
  if (data.projects.some(p => p.name))       score += 10;
  if (data.certifications.length)            score += 5;

  score = Math.min(score, 100);
  const arc = document.getElementById('score-arc');
  const valueEl = document.getElementById('score-value');
  const labelEl = document.getElementById('score-label');
  if (arc) arc.setAttribute('stroke-dasharray', `${score}, 100`);
  if (valueEl) valueEl.textContent = `${score}%`;
  if (labelEl) {
    if (score < 40)      labelEl.textContent = 'Needs more info';
    else if (score < 70) labelEl.textContent = 'Getting there!';
    else if (score < 90) labelEl.textContent = 'Looking good!';
    else                 labelEl.textContent = 'Excellent resume!';
  }
}

// ─── Template Switcher ────────────────────────────────────
function applyTemplate(name) {
  state.currentTemplate = name;
  localStorage.setItem('selectedTemplate', name);
  document.getElementById('template-css').href = `/static/templates/${name}.css`;
  const preview = document.getElementById('resume-preview');
  if (preview) preview.className = `resume-preview ${name}`;
  document.querySelectorAll('.template-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.template === name)
  );
}

// ─── Live Preview Trigger ─────────────────────────────────
let previewDebounce;
function triggerPreviewUpdate() {
  clearTimeout(previewDebounce);
  previewDebounce = setTimeout(() => {
    const preview = document.getElementById('resume-preview');
    if (preview && typeof renderResumePreview === 'function') {
      renderResumePreview(collectFormData(), preview);
    }
  }, 150);
}

// ─── Auto Save ────────────────────────────────────────────
let autoSaveTimer;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem('resumeDraft', JSON.stringify(collectFormData()));
    } catch { /* ignore quota errors */ }
  }, 2000);
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem('resumeDraft');
    if (!raw) return false;
    return JSON.parse(raw);
  } catch { return false; }
}

// ─── Save / Update Resume ─────────────────────────────────
async function saveResume() {
  const data = collectFormData();
  if (!data.name) { showToast('Please enter your full name.', 'error'); return; }

  const btn = document.getElementById('save-btn');
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  btn.disabled = true;

  try {
    const url    = state.editId ? `/update/${state.editId}` : '/save_resume';
    const method = state.editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok) {
      if (!state.editId) state.editId = json.id;
      localStorage.removeItem('resumeDraft');
      showToast(state.editId ? 'Resume updated!' : 'Resume saved!', 'success');
    } else {
      showToast(json.error || 'Failed to save.', 'error');
    }
  } catch {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ─── Load Resume for Editing ──────────────────────────────
async function loadResumeForEdit(id) {
  try {
    const res = await fetch(`/resume/${id}`);
    if (!res.ok) { showToast('Resume not found.', 'error'); return; }
    const data = await res.json();
    state.editId = id;

    // Personal
    ['name','email','phone','address','linkedin','github','portfolio','summary'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.value = data[f] || '';
    });
    updateSummaryCount();
    // Photo
    state.photo = data.photo || null;
    const _editPhotoBox    = document.getElementById('photo-preview-box');
    const _editPhotoRemove = document.getElementById('photo-remove-btn');
    if (state.photo && _editPhotoBox) {
      _editPhotoBox.innerHTML = `<img src="${state.photo}" alt="Photo" />`;
      if (_editPhotoRemove) _editPhotoRemove.style.display = '';
    }

    // Education
    (data.education || []).forEach(e => addEducation(e));

    // Experience
    (data.experience || []).forEach(e => addExperience(e));

    // Skills
    if (data.skills && typeof data.skills === 'object') {
      state.skills.languages    = data.skills.languages    || [];
      state.skills.tools        = data.skills.tools        || [];
      state.skills.technologies = data.skills.technologies || [];
      ['lang','tools','tech'].forEach(k => {
        const fullKey = k === 'lang' ? 'languages' : k === 'tools' ? 'tools' : 'technologies';
        const container = document.getElementById(`skill-${k}-tags`);
        if (container) renderTagList(container, state.skills[fullKey],
          () => { triggerPreviewUpdate(); computeScore(); },
          state.skills, fullKey);
      });
    }

    // Projects
    (data.projects || []).forEach(p => addProject(p));

    // Certifications
    state.certifications = data.certifications || [];
    renderTagList(document.getElementById('cert-tags'), state.certifications,
      () => { triggerPreviewUpdate(); computeScore(); }, state, 'certifications');

    // Languages
    state.languages = data.languages || [];
    renderTagList(document.getElementById('lang-tags'), state.languages,
      () => { triggerPreviewUpdate(); computeScore(); }, state, 'languages');

    document.getElementById('save-btn').innerHTML = '<i class="fas fa-save"></i> Update Resume';
    triggerPreviewUpdate();
    computeScore();
    showToast('Resume loaded for editing.', 'info');
  } catch {
    showToast('Failed to load resume.', 'error');
  }
}

// ─── Generic tag list renderer (used in loadResumeForEdit) ─
function renderTagList(container, arr, onChange, obj, key) {
  if (!container) return;
  container.innerHTML = arr.map((item, i) => `
    <span class="tag-item">${esc(item)}<span class="tag-remove" data-index="${i}">✕</span></span>
  `).join('');
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      obj[key].splice(parseInt(btn.dataset.index), 1);
      renderTagList(container, obj[key], onChange, obj, key);
      onChange();
    });
  });
}

// ─── Summary char count ───────────────────────────────────
function updateSummaryCount() {
  const el = document.getElementById('summary');
  const counter = document.getElementById('summary-count');
  if (el && counter) counter.textContent = el.value.length;
}

// ─── Sidebar active link ──────────────────────────────────
function updateActiveSidebarLink() {
  const sections = document.querySelectorAll('.form-section');
  const links = document.querySelectorAll('.sidebar-link');
  let current = '';
  sections.forEach(sec => {
    const rect = sec.getBoundingClientRect();
    if (rect.top <= 120) current = sec.id;
  });
  links.forEach(l => {
    const href = l.getAttribute('href')?.replace('#', '');
    l.classList.toggle('active', href === current);
  });
}

// ─── Custom Confirm Modal ────────────────────────────────
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-msg').textContent = message;
    overlay.style.display = 'flex';
    const ok     = document.getElementById('confirm-modal-ok');
    const cancel = document.getElementById('confirm-modal-cancel');
    function cleanup(result) {
      overlay.style.display = 'none';
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBg);
      resolve(result);
    }
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBg     = (e) => { if (e.target === overlay) cleanup(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBg);
  });
}

// ─── AI Suggestions (hardcoded by role) ────────────────
const ROLE_SUGGESTIONS = {
  'frontend':         { languages: ['JavaScript','TypeScript','HTML','CSS'], tools: ['VS Code','Git','Webpack','npm','Figma'], technologies: ['React','Vue.js','Tailwind CSS','REST APIs'], summary: 'Creative Frontend Developer skilled in building responsive, high-performance web interfaces using React and modern CSS frameworks. Passionate about clean code and great user experiences.' },
  'backend':          { languages: ['Python','Java','Node.js','SQL'], tools: ['Git','Docker','Postman','Linux','VS Code'], technologies: ['Flask','Django','Express.js','PostgreSQL','Redis'], summary: 'Backend Developer with strong expertise in designing scalable APIs and database architectures. Experienced in Python and Node.js ecosystems with a focus on performance and reliability.' },
  'fullstack':        { languages: ['JavaScript','TypeScript','Python','SQL'], tools: ['Git','Docker','VS Code','Postman','npm'], technologies: ['React','Node.js','Express.js','MongoDB','PostgreSQL'], summary: 'Full Stack Developer proficient in both frontend and backend development. Builds end-to-end web applications using the MERN stack with a focus on clean architecture.' },
  'data scientist':   { languages: ['Python','R','SQL'], tools: ['Jupyter','Git','Tableau','Excel','VS Code'], technologies: ['TensorFlow','Pandas','Scikit-learn','NumPy','Matplotlib'], summary: 'Data Scientist with expertise in machine learning, statistical analysis, and data visualization. Transforms complex datasets into actionable insights to drive business decisions.' },
  'machine learning': { languages: ['Python','R','SQL'], tools: ['Jupyter','Git','Docker','MLflow'], technologies: ['TensorFlow','PyTorch','Scikit-learn','Keras','OpenCV'], summary: 'Machine Learning Engineer experienced in designing and deploying ML models at scale. Proficient in deep learning frameworks and MLOps pipelines for production-grade AI solutions.' },
  'devops':           { languages: ['Python','Bash','YAML'], tools: ['Docker','Kubernetes','Jenkins','Git','Terraform'], technologies: ['AWS','CI/CD','Ansible','Nginx','Linux'], summary: 'DevOps Engineer specializing in automating CI/CD pipelines and managing cloud infrastructure. Proven ability to improve deployment frequency and system reliability through IaC.' },
  'android':          { languages: ['Kotlin','Java','XML'], tools: ['Android Studio','Git','Gradle','Firebase'], technologies: ['Jetpack Compose','Room DB','Retrofit','MVVM','REST APIs'], summary: 'Android Developer with hands-on experience building intuitive mobile applications using Kotlin and Jetpack components. Focused on delivering polished, high-performance Android apps.' },
  'ios':              { languages: ['Swift','Objective-C'], tools: ['Xcode','Git','TestFlight','CocoaPods'], technologies: ['SwiftUI','UIKit','Core Data','REST APIs','Firebase'], summary: 'iOS Developer experienced in crafting elegant, user-friendly iPhone and iPad applications using Swift and SwiftUI. Committed to Apple design guidelines and App Store best practices.' },
  'cybersecurity':    { languages: ['Python','Bash','C'], tools: ['Wireshark','Metasploit','Nmap','Burp Suite','Git'], technologies: ['Penetration Testing','SIEM','Firewalls','Linux','Cryptography'], summary: 'Cybersecurity Analyst skilled in threat detection, vulnerability assessment, and incident response. Dedicated to securing systems and data against evolving cyber threats.' },
  'ui ux':            { languages: ['HTML','CSS','JavaScript'], tools: ['Figma','Adobe XD','Sketch','Zeplin','InVision'], technologies: ['Prototyping','Wireframing','Design Systems','User Research'], summary: 'UI/UX Designer with a passion for creating intuitive and visually appealing digital experiences. Expert in user-centered design and translating business goals into elegant interfaces.' },
  'cloud':            { languages: ['Python','Bash','YAML'], tools: ['Terraform','Docker','Git','AWS CLI','Kubernetes'], technologies: ['AWS','Azure','GCP','Serverless','Microservices'], summary: 'Cloud Engineer with expertise in designing and managing scalable cloud infrastructure on AWS and Azure. Skilled in automating deployments and optimizing costs through cloud-native solutions.' },
  'software engineer':{ languages: ['Python','Java','JavaScript','C++'], tools: ['Git','Docker','Jira','VS Code','Linux'], technologies: ['REST APIs','Microservices','CI/CD','SQL','Agile'], summary: 'Software Engineer with a strong foundation in computer science and hands-on experience building reliable, scalable software solutions. Adept at working across the full development lifecycle.' },
};

function findRoleSuggestion(role) {
  const r = role.toLowerCase().trim();
  if (ROLE_SUGGESTIONS[r]) return ROLE_SUGGESTIONS[r];
  for (const [key, val] of Object.entries(ROLE_SUGGESTIONS)) {
    if (r.includes(key) || key.includes(r)) return val;
  }
  return { languages: ['Python','JavaScript','SQL'], tools: ['Git','VS Code','Docker'], technologies: ['REST APIs','Linux','Agile'], summary: `Dedicated ${role} professional with a passion for solving complex problems and delivering high-quality results. Strong communicator and team player with hands-on technical experience.` };
}

document.getElementById('ai-suggest-btn')?.addEventListener('click', async () => {
  const role = document.getElementById('job-role-input')?.value.trim() || '';
  if (!role) { showToast('Enter a job role first.', 'info'); return; }

  const result = findRoleSuggestion(role);

  (result.languages    || []).forEach(s => { if (!state.skills.languages.includes(s))    state.skills.languages.push(s); });
  (result.tools        || []).forEach(s => { if (!state.skills.tools.includes(s))        state.skills.tools.push(s); });
  (result.technologies || []).forEach(s => { if (!state.skills.technologies.includes(s)) state.skills.technologies.push(s); });
  ['lang','tools','tech'].forEach(k => {
    const fullKey = k === 'lang' ? 'languages' : k === 'tools' ? 'tools' : 'technologies';
    renderTagList(document.getElementById(`skill-${k}-tags`), state.skills[fullKey],
      () => { triggerPreviewUpdate(); computeScore(); }, state.skills, fullKey);
  });

  const summaryEl = document.getElementById('summary');
  if (summaryEl && result.summary) {
    if (!summaryEl.value.trim()) {
      summaryEl.value = result.summary;
    } else if (await showConfirm('Replace current summary with AI suggestion?')) {
      summaryEl.value = result.summary;
    }
    updateSummaryCount();
  }
  triggerPreviewUpdate(); computeScore();
  showToast('Suggestions applied!', 'success');
});

// ─── Dark Mode ────────────────────────────────────────────
(function initDarkMode() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.body.classList.replace('light-mode', 'dark-mode');
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    const icon = btn.querySelector('i');
    if (saved === 'dark' && icon) icon.className = 'fas fa-sun';
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      document.body.classList.replace(isDark ? 'dark-mode' : 'light-mode', isDark ? 'light-mode' : 'dark-mode');
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
      if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    });
  }
})();

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Template buttons
  document.querySelectorAll('.template-btn').forEach(btn =>
    btn.addEventListener('click', () => applyTemplate(btn.dataset.template))
  );
  applyTemplate(state.currentTemplate);

  // Add section buttons
  document.getElementById('add-education')?.addEventListener('click', () => addEducation());
  document.getElementById('add-experience')?.addEventListener('click', () => addExperience());
  document.getElementById('add-project')?.addEventListener('click', () => addProject());

  // Tag inputs
  setupTagInput('skill-lang-input', 'skill-lang-tags', 'languages', 'skills');
  setupTagInput('skill-tools-input', 'skill-tools-tags', 'tools', 'skills');
  setupTagInput('skill-tech-input', 'skill-tech-tags', 'technologies', 'skills');
  setupTagInput('cert-input', 'cert-tags', 'certifications', null);
  setupTagInput('lang-input', 'lang-tags', 'languages', null);

  // Live preview on text inputs
  document.querySelectorAll('#resume-form input, #resume-form textarea').forEach(el => {
    el.addEventListener('input', () => {
      triggerPreviewUpdate();
      computeScore();
      scheduleAutoSave();
    });
  });

  // Summary char count
  document.getElementById('summary')?.addEventListener('input', updateSummaryCount);

  // Photo upload
  (function initPhotoUpload() {
    const photoInput  = document.getElementById('photo-upload');
    const photoBox    = document.getElementById('photo-preview-box');
    const photoRemove = document.getElementById('photo-remove-btn');
    if (!photoInput) return;
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('Photo must be under 2MB.', 'error');
        photoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        state.photo = e.target.result;
        if (photoBox) photoBox.innerHTML = `<img src="${state.photo}" alt="Photo" />`;
        if (photoRemove) photoRemove.style.display = '';
        triggerPreviewUpdate();
        scheduleAutoSave();
      };
      reader.readAsDataURL(file);
    });
    photoRemove?.addEventListener('click', () => {
      state.photo = null;
      photoInput.value = '';
      if (photoBox) photoBox.innerHTML = '<i class="fas fa-user-circle"></i>';
      photoRemove.style.display = 'none';
      triggerPreviewUpdate();
      scheduleAutoSave();
    });
  })();

  // Save button
  document.getElementById('save-btn')?.addEventListener('click', saveResume);

  // Clear form
  document.getElementById('clear-btn')?.addEventListener('click', () => {
    state.skills = { languages: [], tools: [], technologies: [] };
    state.certifications = [];
    state.languages = [];
    state.editId = null;
    state.photo = null;
    const _clearPhotoBox    = document.getElementById('photo-preview-box');
    const _clearPhotoRemove = document.getElementById('photo-remove-btn');
    if (_clearPhotoBox) _clearPhotoBox.innerHTML = '<i class="fas fa-user-circle"></i>';
    if (_clearPhotoRemove) _clearPhotoRemove.style.display = 'none';
    ['skill-lang-tags','skill-tools-tags','skill-tech-tags','cert-tags','lang-tags'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    ['education-container','experience-container','projects-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    updateSummaryCount();
    triggerPreviewUpdate();
    computeScore();
    localStorage.removeItem('resumeDraft');
    document.getElementById('save-btn').innerHTML = '<i class="fas fa-save"></i> Save Resume';
    showToast('Form cleared.', 'info');
  });

  // Restore draft from localStorage
  const draft = restoreDraft();
  if (draft && draft.name && !new URLSearchParams(location.search).has('edit')) {
    if (confirm('You have an unsaved draft. Restore it?')) {
      loadFromObject(draft);
    } else {
      localStorage.removeItem('resumeDraft');
    }
  }

  // Edit mode
  const editId = new URLSearchParams(location.search).get('edit');
  if (editId) loadResumeForEdit(parseInt(editId));

  // Sidebar scroll spy
  document.querySelector('.main-content')?.addEventListener('scroll', updateActiveSidebarLink);

  // Sidebar smooth scroll
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.getAttribute('href')?.replace('#', '');
      const target = document.getElementById(targetId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Initial render
  triggerPreviewUpdate();
  computeScore();
});

// ─── Load from object (draft restore) ────────────────────
function loadFromObject(data) {
  ['name','email','phone','address','linkedin','github','portfolio','summary'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = data[f] || '';
  });
  updateSummaryCount();
  if (data.photo) {
    state.photo = data.photo;
    const _draftPhotoBox    = document.getElementById('photo-preview-box');
    const _draftPhotoRemove = document.getElementById('photo-remove-btn');
    if (_draftPhotoBox) _draftPhotoBox.innerHTML = `<img src="${data.photo}" alt="Photo" />`;
    if (_draftPhotoRemove) _draftPhotoRemove.style.display = '';
  }
  (data.education || []).forEach(e => addEducation(e));
  (data.experience || []).forEach(e => addExperience(e));
  if (data.skills && typeof data.skills === 'object') {
    state.skills = { ...data.skills };
    ['lang','tools','tech'].forEach(k => {
      const fullKey = k === 'lang' ? 'languages' : k === 'tools' ? 'tools' : 'technologies';
      renderTagList(document.getElementById(`skill-${k}-tags`), state.skills[fullKey],
        () => { triggerPreviewUpdate(); computeScore(); }, state.skills, fullKey);
    });
  }
  (data.projects || []).forEach(p => addProject(p));
  state.certifications = data.certifications || [];
  renderTagList(document.getElementById('cert-tags'), state.certifications,
    () => { triggerPreviewUpdate(); computeScore(); }, state, 'certifications');
  state.languages = data.languages || [];
  renderTagList(document.getElementById('lang-tags'), state.languages,
    () => { triggerPreviewUpdate(); computeScore(); }, state, 'languages');
  triggerPreviewUpdate();
  computeScore();
}
