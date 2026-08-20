# Carbon Expansion v9 — status

Реализовано:

- физические speed caps передач: 40 / 90 / 150 / 215 / 285 / 380 км/ч;
- запрет старта на 2–6 передаче через engine stall;
- RPM связан со скоростью внутри диапазона передачи;
- жёлтый GOOD и зелёный PERFECT сектор тахометра;
- ощутимый тяговый импульс PERFECT SHIFT;
- прогрессивная тяга и limiter behavior на каждой передаче;
- AI с собственными передачами и shift pauses;
- старт с фактических 0 км/ч;
- более короткий и динамичный race distance;
- Canvas speed FX в общем RAF-loop;
- 20 Hz DOM HUD + адаптивное снижение Canvas quality;
- визуальный gap meter, time gap и overtake pulse;
- лучший 0–100 в статистике;
- server-synchronized case roll ID/prize;
- точное центрирование final case item по DOM geometry;
- recovery незавершённых case rolls;
- SVG слот-машина без emoji/белого text overlay;
- расширенные player profiles;
- друзья по ID/@Telegram login;
- friend requests и accepted friendship;
- кланы, invite друзей, roster management;
- global/division clan leaderboard;
- дивизионы от «Мантика» до «Легенда»;
- `supabase/schema_v9.sql`.

Архитектурное ограничение остаётся прежним: основной wallet/inventory игры не полностью server-authoritative. См. `SECURITY.md`.
