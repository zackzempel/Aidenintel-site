/* ─── Aiden Intel Lead Widget ─── */
(function () {
  const SUPABASE_URL = 'https://oftrlapeiqvokgnsscxa.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_5Yb-xvGR2Wbng3dK5gSODg_Dl5v_mtB';

  const css = `
    #ai-fab {
      position: fixed;
      bottom: 28px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }
    #ai-fab-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(99,102,241,0.5);
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #ai-fab-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(99,102,241,0.7);
    }
    #ai-fab-btn::before {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: rgba(99,102,241,0.25);
      animation: fab-pulse 2.5s ease-in-out infinite;
    }
    @keyframes fab-pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50%       { transform: scale(1.35); opacity: 0; }
    }
    #ai-fab-btn svg { position: relative; z-index: 1; }
    #ai-fab-label {
      background: rgba(15,18,34,0.95);
      border: 1px solid rgba(99,102,241,0.3);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #818cf8;
      letter-spacing: 0.04em;
      white-space: nowrap;
      backdrop-filter: blur(10px);
      animation: label-bob 3s ease-in-out infinite;
    }
    @keyframes label-bob {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-4px); }
    }

    /* OVERLAY */
    #ai-overlay {
      position: fixed;
      inset: 0;
      background: rgba(5,7,15,0.7);
      backdrop-filter: blur(6px);
      z-index: 10000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    #ai-overlay.open {
      opacity: 1;
      pointer-events: all;
    }

    /* MODAL */
    #ai-modal {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 10001;
      background: linear-gradient(160deg, #0f1222 0%, #1a1f3a 100%);
      border-top: 1px solid rgba(99,102,241,0.3);
      border-radius: 24px 24px 0 0;
      padding: 32px 28px 48px;
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
      max-width: 560px;
      margin: 0 auto;
    }
    #ai-modal.open {
      transform: translateY(0);
    }
    #ai-modal-handle {
      width: 40px; height: 4px;
      background: rgba(255,255,255,0.15);
      border-radius: 2px;
      margin: 0 auto 28px;
    }
    #ai-modal h2 {
      font-size: 1.2rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 6px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #ai-modal p {
      font-size: 0.82rem;
      color: #94a3b8;
      margin-bottom: 24px;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* MIC BUTTON */
    #ai-mic-btn {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: rgba(99,102,241,0.12);
      border: 2px solid rgba(99,102,241,0.35);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      margin: 0 auto 20px;
      transition: all 0.2s;
      position: relative;
    }
    #ai-mic-btn:hover { background: rgba(99,102,241,0.2); }
    #ai-mic-btn.recording {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.6);
      animation: mic-pulse 1s ease-in-out infinite;
    }
    @keyframes mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
      50%       { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
    }
    #ai-mic-label {
      text-align: center;
      font-size: 0.72rem;
      color: #6b7280;
      margin-bottom: 20px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #ai-divider {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 16px;
    }
    #ai-divider::before, #ai-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.07);
    }
    #ai-divider span {
      font-size: 0.7rem;
      color: #475569;
      font-family: 'Inter', system-ui, sans-serif;
    }

    #ai-name {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 12px 14px;
      color: #f1f5f9;
      font-size: 0.88rem;
      font-family: 'Inter', system-ui, sans-serif;
      margin-bottom: 10px;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    #ai-name:focus { border-color: rgba(99,102,241,0.5); }
    #ai-name::placeholder { color: #475569; }

    #ai-textarea {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 14px;
      color: #f1f5f9;
      font-size: 0.88rem;
      font-family: 'Inter', system-ui, sans-serif;
      resize: none;
      height: 100px;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    #ai-textarea:focus { border-color: rgba(99,102,241,0.5); }
    #ai-textarea::placeholder { color: #475569; }

    #ai-submit {
      width: 100%;
      padding: 15px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      box-shadow: 0 4px 20px rgba(99,102,241,0.35);
      transition: opacity 0.2s, transform 0.2s;
    }
    #ai-submit:hover { opacity: 0.9; transform: translateY(-1px); }
    #ai-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* SUCCESS */
    #ai-success {
      display: none;
      text-align: center;
      padding: 20px 0;
    }
    #ai-success .check {
      font-size: 3rem;
      margin-bottom: 16px;
    }
    #ai-success h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 8px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #ai-success p {
      font-size: 0.82rem;
      color: #94a3b8;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #ai-close {
      position: absolute;
      top: 20px; right: 24px;
      background: none;
      border: none;
      color: #475569;
      font-size: 1.4rem;
      cursor: pointer;
      line-height: 1;
    }
  `;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Inject HTML
  const html = `
    <div id="ai-fab">
      <div id="ai-fab-label">What can we build for you?</div>
      <button id="ai-fab-btn" aria-label="Contact Aiden Intel">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    </div>

    <div id="ai-overlay"></div>

    <div id="ai-modal" role="dialog" aria-modal="true">
      <button id="ai-close">×</button>
      <div id="ai-modal-handle"></div>

      <div id="ai-form-content">
        <h2>What would you like us to build?</h2>
        <p>Tap the mic and tell us — or type it out. We'll take it from there.</p>

        <button id="ai-mic-btn" aria-label="Start voice input">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <div id="ai-mic-label">Tap to speak</div>

        <div id="ai-divider"><span>or type it</span></div>

        <input id="ai-name" type="text" placeholder="Your name (optional)" autocomplete="name" />
        <textarea id="ai-textarea" placeholder="Describe what you'd like automated, built, or streamlined..."></textarea>
        <button id="ai-submit">Send to Aiden →</button>
      </div>

      <div id="ai-success">
        <div class="check">✅</div>
        <h3>Aiden's got it.</h3>
        <p>We'll review your request and reach out soon.<br>Welcome to the future of your business.</p>
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // ─── LOGIC ───
  const fab = document.getElementById('ai-fab-btn');
  const overlay = document.getElementById('ai-overlay');
  const modal = document.getElementById('ai-modal');
  const closeBtn = document.getElementById('ai-close');
  const micBtn = document.getElementById('ai-mic-btn');
  const micLabel = document.getElementById('ai-mic-label');
  const textarea = document.getElementById('ai-textarea');
  const nameInput = document.getElementById('ai-name');
  const submitBtn = document.getElementById('ai-submit');
  const formContent = document.getElementById('ai-form-content');
  const success = document.getElementById('ai-success');

  function openModal() {
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  fab.addEventListener('click', openModal);
  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);

  // ─── VOICE INPUT ───
  let recognition = null;
  let isRecording = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      textarea.value = transcript;
    };
    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording');
      micLabel.textContent = 'Tap to speak';
      micBtn.querySelector('stroke') && null;
      micBtn.querySelector('svg').querySelector('path').setAttribute('stroke', '#818cf8');
    };

    micBtn.addEventListener('click', () => {
      if (isRecording) {
        recognition.stop();
      } else {
        recognition.start();
        isRecording = true;
        micBtn.classList.add('recording');
        micLabel.textContent = '● Recording... tap to stop';
        micBtn.querySelectorAll('svg *').forEach(el => {
          if (el.getAttribute('stroke')) el.setAttribute('stroke', '#ef4444');
        });
      }
    });
  } else {
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
    micLabel.textContent = 'Voice not supported on this browser';
    micBtn.addEventListener('click', () => textarea.focus());
  }

  // ─── SUBMIT ───
  submitBtn.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) {
      textarea.focus();
      textarea.style.borderColor = 'rgba(239,68,68,0.5)';
      setTimeout(() => textarea.style.borderColor = '', 1500);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const name = nameInput.value.trim() || 'Anonymous Prospect';

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/client_requests`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          client_name: name,
          client_id: 'prospect',
          request_type: 'New Business Inquiry',
          message,
          status: 'new'
        })
      });

      formContent.style.display = 'none';
      success.style.display = 'block';
      setTimeout(closeModal, 4000);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send to Aiden →';
      alert('Something went wrong. Please try again.');
    }
  });

})();
