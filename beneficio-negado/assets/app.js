(function () {
  "use strict";

  const cfg = window.CAMPAIGN_CONFIG || {};
  const tracking = window.CampaignTracking || { track() {}, trackCustom() {}, newEventId: p => `${p}-${Date.now()}` };
  const questionario = document.getElementById("leadQuestionario");
  const steps = Array.from(document.querySelectorAll("[data-questionario-step]"));
  const progressBar = document.getElementById("questionarioProgress");
  const progressText = document.getElementById("questionarioProgressText");
  const questionarioError = document.getElementById("questionarioError");
  const phoneInput = document.getElementById("whatsapp");
  const nameInput = document.getElementById("nome");
  const consentInput = document.getElementById("consentimento");
  const submitButton = document.getElementById("questionarioSubmit");
  const modal = document.getElementById("privacyModal");
  const video = document.getElementById("campaignVideo");
  const state = {
    step: 0,
    answers: {},
    questionarioStarted: false,
    videoTracked: false,
    submitting: false
  };

  function clean(value) {
    return String(value || "").trim();
  }

  function getUtms() {
    const params = new URLSearchParams(location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
    const current = {};
    keys.forEach(key => {
      const value = params.get(key);
      if (value) current[key] = value.slice(0, 500);
    });
    if (Object.keys(current).length) {
      sessionStorage.setItem("campanha_inss_utms", JSON.stringify(current));
      return current;
    }
    try {
      return JSON.parse(sessionStorage.getItem("campanha_inss_utms") || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  const utms = getUtms();

  function updateProgress() {
    const total = steps.length;
    const current = Math.min(state.step + 1, total);
    const percentage = Math.round((current / total) * 100);
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `Etapa ${current} de ${total}`;
  }

  function showStep(index, focusHeading) {
    const bounded = Math.max(0, Math.min(index, steps.length - 1));
    state.step = bounded;
    steps.forEach((step, i) => {
      const active = i === bounded;
      step.classList.toggle("is-active", active);
      step.setAttribute("aria-hidden", active ? "false" : "true");
    });
    if (questionarioError) questionarioError.textContent = "";
    updateProgress();
    if (focusHeading) {
      const heading = steps[bounded].querySelector("h3");
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  function selectedForStep(step) {
    const key = step.dataset.question;
    return key && state.answers[key];
  }

  function validateCurrentStep() {
    const step = steps[state.step];
    if (!step) return false;
    if (step.dataset.contact === "true") return validateContact();
    if (!selectedForStep(step)) {
      if (questionarioError) questionarioError.textContent = "Selecione uma opção para continuar.";
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    if (state.step < steps.length - 1) showStep(state.step + 1, true);
  }

  function previousStep() {
    if (state.step > 0) showStep(state.step - 1, true);
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatPhone(value) {
    const raw = digits(value).slice(0, 11);
    if (raw.length <= 2) return raw ? `(${raw}` : "";
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  }

  function setFieldError(input, message) {
    if (!input) return;
    input.setAttribute("aria-invalid", message ? "true" : "false");
    const error = document.getElementById(`${input.id}Error`);
    if (error) error.textContent = message || "";
  }

  function validateContact() {
    const name = clean(nameInput && nameInput.value);
    const phone = digits(phoneInput && phoneInput.value);
    let valid = true;

    if (name.length < 2) {
      setFieldError(nameInput, "Informe seu nome.");
      valid = false;
    } else {
      setFieldError(nameInput, "");
    }

    if (phone.length < 10 || phone.length > 11 || phone.startsWith("0")) {
      setFieldError(phoneInput, "Informe um WhatsApp com DDD.");
      valid = false;
    } else {
      setFieldError(phoneInput, "");
    }

    if (!consentInput || !consentInput.checked) {
      if (questionarioError) questionarioError.textContent = "Confirme a autorização para receber o contato pelo WhatsApp.";
      valid = false;
    } else if (questionarioError) {
      questionarioError.textContent = "";
    }

    return valid;
  }

  function answerLabel(question, value) {
    const step = steps.find(item => item.dataset.question === question);
    const option = step && step.querySelector(`[data-value="${CSS.escape(value)}"]`);
    return option ? clean(option.textContent) : value;
  }

  function buildLead() {
    const eventId = tracking.newEventId("lead");
    return {
      event_id: eventId,
      created_at: new Date().toISOString(),
      page_url: location.href,
      page_path: location.pathname,
      referrer: document.referrer || "",
      campaign: cfg.campaignName || "beneficio_negado_inss_2026",
      nome: clean(nameInput.value),
      whatsapp: digits(phoneInput.value),
      beneficio: state.answers.beneficio,
      beneficio_label: answerLabel("beneficio", state.answers.beneficio),
      quando: state.answers.quando,
      quando_label: answerLabel("quando", state.answers.quando),
      carta: state.answers.carta,
      carta_label: answerLabel("carta", state.answers.carta),
      consentimento: true,
      utms
    };
  }

  function buildWhatsAppUrl(lead) {
    const source = lead.utms.utm_campaign || lead.utms.utm_source || "landing page";
    const message = [
      "Olá, vim pela campanha sobre benefício negado pelo INSS.",
      "",
      `Meu nome: ${lead.nome}`,
      `Benefício negado: ${lead.beneficio_label}`,
      `Quando recebi a negativa: ${lead.quando_label}`,
      `Carta de decisão: ${lead.carta_label}`,
      `Origem: ${source}`,
      "",
      "Gostaria de receber uma orientação inicial sobre os próximos passos."
    ].join("\n");
    return `https://api.whatsapp.com/send/?phone=${cfg.whatsappNumber || "554399809716"}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
  }

  function saveThankYouData(lead, whatsappUrl) {
    const summary = [
      `Benefício: ${lead.beneficio_label}`,
      `Negativa recebida: ${lead.quando_label}`,
      `Carta de decisão: ${lead.carta_label}`
    ].join("\n");
    sessionStorage.setItem("campanha_inss_thankyou", JSON.stringify({
      nome: lead.nome,
      summary,
      whatsappUrl,
      eventId: lead.event_id,
      timestamp: Date.now()
    }));
  }

  function submitLead(event) {
    event.preventDefault();
    if (state.submitting || !validateContact()) return;
    state.submitting = true;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    const originalText = submitButton.innerHTML;
    submitButton.textContent = "Abrindo o WhatsApp…";

    const lead = buildLead();
    const whatsappUrl = buildWhatsAppUrl(lead);
    saveThankYouData(lead, whatsappUrl);

    tracking.track("Lead", {
      content_name: "Pre-analise beneficio negado INSS",
      content_category: lead.beneficio,
      status: "questionario_completo"
    }, lead.event_id);
    tracking.track("Contact", {
      content_name: "WhatsApp campanha beneficio negado",
      content_category: lead.beneficio
    });
    tracking.trackCustom("LeadQualificado", {
      beneficio: lead.beneficio,
      quando: lead.quando,
      possui_carta: lead.carta
    });


    const newWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => {
      location.href = "obrigado.html";
    }, newWindow ? 180 : 80);

    setTimeout(() => {
      state.submitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = originalText;
    }, 2500);
  }

  function startQuestionario() {
    if (!state.questionarioStarted) {
      state.questionarioStarted = true;
      tracking.trackCustom("QuestionarioIniciado", { content_name: "Beneficio negado INSS" });
    }
  }

  document.querySelectorAll("[data-scroll-questionario]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      startQuestionario();
      document.getElementById("pre-analise").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        const firstOption = steps[state.step] && steps[state.step].querySelector(".option");
        if (firstOption) firstOption.focus({ preventScroll: true });
      }, 600);
    });
  });

  document.querySelectorAll(".option[data-value]").forEach(option => {
    option.addEventListener("click", () => {
      startQuestionario();
      const step = option.closest("[data-questionario-step]");
      const key = step.dataset.question;
      const value = option.dataset.value;
      state.answers[key] = value;
      step.querySelectorAll(".option").forEach(item => {
        const selected = item === option;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-checked", selected ? "true" : "false");
      });
      if (questionarioError) questionarioError.textContent = "";
      tracking.trackCustom("QuestionarioResposta", { pergunta: key, resposta: value });
      window.setTimeout(() => {
        if (state.step < steps.length - 1 && step.classList.contains("is-active")) nextStep();
      }, 240);
    });
  });

  document.querySelectorAll("[data-next]").forEach(button => button.addEventListener("click", nextStep));
  document.querySelectorAll("[data-back]").forEach(button => button.addEventListener("click", previousStep));

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = formatPhone(phoneInput.value);
      if (digits(phoneInput.value).length >= 10) setFieldError(phoneInput, "");
    });
  }
  if (nameInput) nameInput.addEventListener("input", () => { if (clean(nameInput.value).length >= 2) setFieldError(nameInput, ""); });
  if (consentInput) consentInput.addEventListener("change", () => { if (consentInput.checked && questionarioError) questionarioError.textContent = ""; });
  if (questionario) questionario.addEventListener("submit", submitLead);

  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const close = modal.querySelector("[data-close-privacy]");
    if (close) close.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  document.querySelectorAll("[data-open-privacy]").forEach(button => button.addEventListener("click", openModal));
  document.querySelectorAll("[data-close-privacy]").forEach(button => button.addEventListener("click", closeModal));
  if (modal) modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && modal && modal.classList.contains("is-open")) closeModal(); });

  document.querySelectorAll("[data-direct-whatsapp]").forEach(link => {
    link.addEventListener("click", () => {
      tracking.track("Contact", { content_name: "WhatsApp direto campanha beneficio negado" });
    });
  });

  if (video) {
    video.addEventListener("play", () => {
      if (!state.videoTracked) {
        state.videoTracked = true;
        tracking.trackCustom("VideoReproduzido", { content_name: "Criativo beneficio negado INSS" });
      }
    });
  }

  tracking.track("ViewContent", {
    content_name: "Landing page beneficio negado INSS",
    content_category: "Direito Previdenciario",
    content_type: "landing_page"
  });

  showStep(0, false);
})();
