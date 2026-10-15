# TODO_PHASE1 — pEc-XeL Website (Phase 1)

## Scope (per user)
Implement in `pecxel-website/index.html`:
1. Floating Engineering Support Button (bottom-right, label, subtle pulse)
2. Professional Welcome Modal (collect name, email, phone, company)
3. Department Selection screen/step
4. pEcXel AI Engineer interface with greeting
5. Keyword-based AI responses (Solar, PLC, Arduino, ESP32, Laptop, Computer, Phone, Battery, Inverter, Wiring, Automation, Electronics)
6. Human escalation when AI can't answer (Connect to Engineer + Leave a Message)

## Steps
- [ ] Update `pecxel-website/index.html`: add floating button + modal + AI chat UI + department selection step containers.
- [ ] Update `pecxel-website/style.css`: add styles + pulse animation + modal/chat layout.
- [ ] Update `pecxel-website/script.js`: wire button → modal → department selection → AI chat; implement keyword response engine + escalation handling.
- [ ] Ensure no selector conflicts with existing AI modal (`#aiAssistantModal`) and floating AI button (`#aiAssistantBtn`).
- [ ] Manual test checklist:
  - [ ] Button opens welcome modal
  - [ ] Submit welcome collects required fields (name/email) validation
  - [ ] Department selection updates AI greeting context
  - [ ] Keyword prompts produce deterministic responses
  - [ ] Unknown query shows escalation UI


