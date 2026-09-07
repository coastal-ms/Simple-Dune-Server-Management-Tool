# DST operating contract

This file is the canonical source for DST session routing. Other instructions,
skills, routines, and handoffs must reference or mechanically mirror it rather
than redefine it.

- **Sync trigger:** Run `sync` only when Coastal's entire message is exactly
  `sync` or `/sync`. Run `syncsave` only when the entire message is exactly
  `syncsave` or `/syncsave`. Loading tools, entering this repository, opening a
  session, `go`, and ordinary DST work are not triggers.
- **Parent authority:** GPT-5.6 Sol is the proven active DST parent. The parent
  owns user communication, context, integration, validation reconciliation,
  approval gates, Discord, release authority, and completion.
- **Implementation routing:** Meaningful, broad, or safety-critical DST coding
  goes only to app-native coordinated child sessions with an explicitly selected
  appropriate GPT-5.6 Sol or GPT-6 Astra model. Do not use Task/background agents
  for substantive DST work. A tiny, clearly bounded edit may remain in the parent
  when that is safer than delegation.
- **Child communication:** Children report work, evidence, blockers, and
  questions to the parent and never ask Coastal directly.
- **Discord ownership:** Discord monitoring and member communication stay with
  the active parent while implementation children work.
- **Release authority:** Children may prepare bounded evidence or code, but the
  parent owns integration, release validation, approval gates, publishing, and
  final completion.

When this contract changes, update this file first, update only the necessary
references, then run the local control-plane validator documented by the private
DST routines.
