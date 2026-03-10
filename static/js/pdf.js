/**
 * pdf.js — Smart Resume Builder
 * Handles PDF download using html2pdf.js.
 * Attached to the "Download PDF" button on the main builder page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('download-btn');
  if (!downloadBtn) return;

  // Zoom controls
  let zoomScale = 1;
  const zoomTarget = document.getElementById('preview-zoom-target');
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    zoomScale = Math.min(zoomScale + 0.1, 1.6);
    if (zoomTarget) zoomTarget.style.zoom = zoomScale;
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    zoomScale = Math.max(zoomScale - 0.1, 0.5);
    if (zoomTarget) zoomTarget.style.zoom = zoomScale;
  });

  downloadBtn.addEventListener('click', () => {
    const el = document.getElementById('resume-preview');
    if (!el) return;

    // Guard: nothing to export yet
    const placeholder = el.querySelector('.preview-placeholder');
    if (placeholder) {
      alert('Please fill in your resume details before downloading.');
      return;
    }

    const nameEl = el.querySelector('.preview-name');
    const filename = nameEl?.textContent
      ? `${nameEl.textContent.trim().replace(/\s+/g, '_')}_Resume.pdf`
      : 'Resume.pdf';

    const btn = document.getElementById('download-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
    btn.disabled = true;

    // Override styles on the element itself so html2canvas can see it in-place.
    // html2canvas cannot render off-screen (negative position) clones.
    const savedStyle = el.getAttribute('style') || '';
    el.style.width = '794px';
    el.style.maxWidth = 'none';
    el.style.boxShadow = 'none';
    el.style.borderRadius = '0';
    el.style.zoom = '1';

    function restore() {
      if (savedStyle) el.setAttribute('style', savedStyle);
      else el.removeAttribute('style');
      btn.innerHTML = orig;
      btn.disabled = false;
    }

    html2pdf()
      .set({
        margin:      [8, 8, 8, 8],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 794 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save()
      .then(() => {
        restore();
        if (typeof showToast === 'function') showToast('PDF downloaded!', 'success');
      })
      .catch(() => {
        restore();
        if (typeof showToast === 'function') showToast('PDF generation failed.', 'error');
      });
  });
});
