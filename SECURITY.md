# Security notes — AutoSyndicate Expansion v9

## Supabase ownership

Онлайн-функции используют Anonymous Auth, `auth.uid()`, RLS и `SECURITY DEFINER` RPC для контролируемых операций. В клиенте должен находиться только publishable/anon key.

Никогда не размещай в HTML/JS:

- `service_role`;
- PostgreSQL password;
- JWT signing secret;
- Telegram bot token;
- секреты платёжных систем.

## Друзья

Friend request создаётся только серверным RPC. Сервер:

- находит игрока по ID или `telegram_username`;
- запрещает self-request;
- запрещает повторную friendship-пару в любом направлении;
- разрешает читать friendship только двум участникам.

## Кланы

Clan membership и invite transitions выполняются серверными RPC.

- один `member_uid` может находиться только в одном клане;
- название клана уникально case-insensitive;
- invite разрешён только для accepted friend;
- обычный клиент не получает direct write policy к `clan_members`/`clan_invites`;
- kick разрешён владельцу клана;
- владелец не может просто выйти из клана, пока в нём остаются участники.

## Кейсы

v9 убирает источник визуального/server desync:

- сервер фиксирует `roll_id` и `prize` до анимации;
- декоративная лента не меняет pity;
- final element и выдача используют один prize object;
- незавершённые rolls можно reconciliate;
- локальный список `caseAppliedRolls` защищает от обычного повторного применения одного roll после сбоя сети.

### Ограничение экономики

Основной SYND wallet, тюнинг и большая часть инвентаря исторически остаются в `localStorage`. Поэтому server roll кейса делает результат детерминированным и синхронизированным, но **не превращает всю экономику в server-authoritative**.

Пользователь с DevTools всё ещё способен изменять собственный локальный wallet/inventory. Для валюты с реальной стоимостью нужна отдельная миграция:

- серверный wallet ledger;
- серверный inventory с instance ID;
- серверное списание цены кейса в одной транзакции с созданием roll;
- серверные ставки казино;
- подписанные race sessions/result validation;
- idempotency keys на каждую экономическую операцию.

До этого SYND следует считать виртуальной игровой валютой без реальной денежной стоимости.

## Clan leaderboard

Clan score собирается из публичных profile metrics. Эти метрики синхронизируются клиентом и потому не являются античит-доказательством. Для соревновательного рейтинга с ценными наградами wins/rating должны формироваться только сервером.

## Telegram

`initDataUnsafe` используется для UI-полей, включая username. Для доверенной авторизации платежей/ценных активов Telegram `initData` необходимо валидировать сервером по официальной подписи.
