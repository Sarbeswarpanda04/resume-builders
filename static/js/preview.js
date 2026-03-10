/**
 * preview.js — Smart Resume Builder
 * Renders resume data into the live preview pane.
 * Used by both index.html (live updating) and preview.html (load from API).
 */

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Render resume data into the target DOM element.
 * @param {Object} data - Resume data object
 * @param {HTMLElement} container - Target element to render into
 */
function renderResumePreview(data, container) {
  if (!container) return;

  const hasPersonal = data.name || data.email || data.phone || data.address;
  const hasLinks    = data.linkedin || data.github || data.portfolio;
  const hasEdu      = (data.education  || []).some(e => e.degree || e.college);
  const hasExp      = (data.experience || []).some(e => e.company || e.role);
  const hasProjects = (data.projects   || []).some(p => p.name);
  const allSkills   = [
    ...(data.skills?.languages    || []),
    ...(data.skills?.tools        || []),
    ...(data.skills?.technologies || []),
  ];
  const hasCerts = (data.certifications || []).length > 0;
  const hasLangs = (data.languages || []).length > 0;

  if (!hasPersonal && !data.summary && !hasEdu && !hasExp && !hasProjects && allSkills.length === 0) {
    container.innerHTML = `
      <div class="preview-placeholder">
        <i class="fas fa-file-alt"></i>
        <p>Start filling the form to see your resume preview</p>
      </div>`;
    return;
  }

  let html = '';

  // Header
  html += `<div class="preview-header-section">`;
  html += `<div class="preview-name">${esc(data.name || 'Your Name')}</div>`;
  if (hasPersonal || hasLinks) {
    html += `<div class="preview-contact">`;
    if (data.email)     html += `<span><i class="fas fa-envelope"></i>${esc(data.email)}</span>`;
    if (data.phone)     html += `<span><i class="fas fa-phone"></i>${esc(data.phone)}</span>`;
    if (data.address)   html += `<span><i class="fas fa-map-marker-alt"></i>${esc(data.address)}</span>`;
    html += `</div>`;
    if (hasLinks) {
      html += `<div class="preview-links preview-header-links">`;
      if (data.linkedin)  html += `<a href="#"><i class="fab fa-linkedin"></i>${esc(data.linkedin)}</a>`;
      if (data.github)    html += `<a href="#"><i class="fab fa-github"></i>${esc(data.github)}</a>`;
      if (data.portfolio) html += `<a href="#"><i class="fas fa-globe"></i>${esc(data.portfolio)}</a>`;
      html += `</div>`;
    }
  }
  html += `</div>`;

  // Body
  html += `<div class="preview-body">`;

  // Summary
  if (data.summary) {
    html += section('Summary', `<p class="preview-summary">${esc(data.summary)}</p>`);
  }

  // Education
  if (hasEdu) {
    let inner = '';
    (data.education || []).forEach(e => {
      if (!e.degree && !e.college) return;
      inner += `
        <div class="preview-item">
          <div class="preview-item-header">
            <span class="preview-item-title">${esc(e.degree)}</span>
            <span class="preview-item-date">${esc(e.year)}</span>
          </div>
          <div class="preview-item-sub">${esc(e.college)}${e.grade ? ' · ' + esc(e.grade) : ''}</div>
        </div>`;
    });
    html += section('Education', inner);
  }

  // Experience
  if (hasExp) {
    let inner = '';
    (data.experience || []).forEach(e => {
      if (!e.company && !e.role) return;
      inner += `
        <div class="preview-item">
          <div class="preview-item-header">
            <span class="preview-item-title">${esc(e.role)}</span>
            <span class="preview-item-date">${esc(e.duration)}</span>
          </div>
          <div class="preview-item-sub">${esc(e.company)}</div>
          ${e.description ? `<div class="preview-item-desc">${esc(e.description)}</div>` : ''}
        </div>`;
    });
    html += section('Experience', inner);
  }

  // Skills
  if (allSkills.length > 0) {
    const tags = allSkills.map(s => `<span class="preview-skill-tag">${esc(s)}</span>`).join('');
    html += section('Skills', `<div class="preview-skills">${tags}</div>`);
  }

  // Projects
  if (hasProjects) {
    let inner = '';
    (data.projects || []).forEach(p => {
      if (!p.name) return;
      inner += `
        <div class="preview-item">
          <div class="preview-item-header">
            <span class="preview-item-title">${esc(p.name)}</span>
            ${p.github ? `<a href="#" style="font-size:.7rem;color:var(--primary, #4F46E5)"><i class="fab fa-github"></i> GitHub</a>` : ''}
          </div>
          ${p.technologies ? `<div class="preview-item-sub">${esc(p.technologies)}</div>` : ''}
          ${p.description  ? `<div class="preview-item-desc">${esc(p.description)}</div>`  : ''}
        </div>`;
    });
    html += section('Projects', inner);
  }

  // Certifications
  if (hasCerts) {
    const items = (data.certifications || []).map(c =>
      `<div class="preview-item"><span class="preview-item-title"><i class="fas fa-certificate" style="color:#F59E0B;margin-right:.3rem"></i>${esc(c)}</span></div>`
    ).join('');
    html += section('Certifications', items);
  }

  // Languages
  if (hasLangs) {
    const tags = (data.languages || []).map(l => `<span class="preview-skill-tag">${esc(l)}</span>`).join('');
    html += section('Languages', `<div class="preview-skills">${tags}</div>`);
  }

  html += `</div>`; // /preview-body
  container.innerHTML = html;
}

function section(title, content) {
  return `
    <div class="preview-section">
      <div class="preview-section-title">${esc(title)}</div>
      ${content}
    </div>`;
}
