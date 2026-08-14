# PopovichFit — виджет тарифов для Тильды

Две отдельные публичные страницы (два iframe) и две отдельные админки. Редактор — обычные поля и превью; на сайт публикуется через GitHub Pages.

## Публичные страницы

- **Коррекция:** https://elenasamanchuk.github.io/popovichfit-tariffs/korrekciya.html
- **Силовые:** https://elenasamanchuk.github.io/popovichfit-tariffs/silovye.html
- **Выбор курса:** https://elenasamanchuk.github.io/popovichfit-tariffs/ (старый `/` больше не один виджет)

## Админки

Каждая админка сначала показывает экран входа (логин + пароль). После входа — форма с полями и живым превью справа. Кнопка **«Сохранить»** коммитит конфиг курса в `main`. Сырой JSON спрятан в свёрнутом блоке «Для разработчика».

- **Админка коррекции:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin-korrekciya.html
- **Админка силовых:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin-silovye.html
- **Выбор админки:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin.html

Черновики не пересекаются: `PF_ADMIN_DRAFT_korrekciya` и `PF_ADMIN_DRAFT_silovye`.

### Как войти коллеге

1. Откройте нужную админку по ссылке выше.
2. Введите общий логин и пароль команды (логин — поле `login` в `admin-lock.json`, пароль передаётся отдельно, не из репозитория).
3. По желанию отметьте «Запомнить на этом компьютере» (7 дней). Иначе сессия живёт до закрытия браузера.
4. Правите поля — справа превью обновляется сразу.
5. Нажмите **Сохранить**. Поле GitHub-токена коллегам не показывается.

### Как владельцу один раз подключить GitHub

1. Войдите в админку.
2. Если ключа ещё нет, откроется блок **«Подключение GitHub (один раз)»**. Если ключ уже есть — ссылка **«Сменить ключ»**.
3. Вставьте Personal Access Token с правом `repo` (Contents: write) на `ElenaSamanchuk/popovichfit-tariffs`.
4. Нажмите **«Зашифровать и сохранить ключ»**. Токен шифруется паролем входа (AES-GCM + PBKDF2) и пишется в `admin-secret.json`. Сырой токен в репозиторий не попадает.
5. Дальше коллегам достаточно войти и нажать «Сохранить».

Если `admin-secret.json` ещё нет, «Сохранить» напишет: «Владелец должен один раз вставить GitHub-токен после входа».

## Безопасность

Это **общий пароль команды**, не банковская защита. Пароль — ключ к расшифровке GitHub-токена: кто знает пароль, тот может сохранить на сайт.

- Не ставьте слишком простой пароль на проде.
- Логин и пароль меняются в одном файле `admin-lock.json`. В репозитории хранится только SHA-256 от строки `логин:пароль`, не сам пароль.
- Как посчитать хеш:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('ЛОГИН:ПАРОЛЬ','utf8').digest('hex'))"
```

Подставьте полученный хеш в `hash`, логин — в `login`. После смены пароля владелец должен заново открыть «Сменить ключ» и сохранить токен: старый `admin-secret.json` расшифруется только старым паролем.

- Не коммитьте сырой PAT. `admin-secret.json` публичный, но внутри только шифротекст.

## Как вставить на Тильду

На каждую страницу Тильды — свой блок **HTML-код (T123)**.

- Курс коррекция: содержимое [`tilda-embed-korrekciya.html`](tilda-embed-korrekciya.html)  
  iframe: `…/korrekciya.html`, id `popovich-tariffs-korrekciya-*`
- Курс силовые: содержимое [`tilda-embed-silovye.html`](tilda-embed-silovye.html)  
  iframe: `…/silovye.html`, id `popovich-tariffs-silovye-*`

Оба блока можно поставить на один сайт: id разные, протокол `postMessage` тот же (`popovich-tariffs-resize` / `popovich-tariffs-modal`). Каждый скрипт слушает только свой iframe.

## Откуда контент

Тексты шапок, карточек и бейджей — с [popovichfit.ru/new-course](https://popovichfit.ru/new-course) (блоки «Курс коррекция» и «Курс силовой»). Цены и ссылки оплаты — из `window.PF_CARDS`. Плашка и попап подписки новые: ссылки подписки пока пустые, их можно прописать в админке.

## Файлы

| Файл | Назначение |
| --- | --- |
| `korrekciya.html` | Публичный виджет коррекции |
| `silovye.html` | Публичный виджет силовых |
| `config-korrekciya.json` | Контент коррекции |
| `config-silovye.json` | Контент силовых |
| `config.json` | Копия силовых (совместимость) |
| `admin-korrekciya.html` | Админка коррекции |
| `admin-silovye.html` | Админка силовых |
| `admin-lock.json` | Хеш общего логина/пароля |
| `admin-secret.json` | Зашифрованный GitHub-токен (создаёт владелец) |
| `tilda-embed-korrekciya.html` | Готовый HTML+JS для Тильды, коррекция |
| `tilda-embed-silovye.html` | Готовый HTML+JS для Тильды, силовые |
| `js/widget.js` | Рендер, читает `data-config` |
| `js/admin.js` | Вход, формы, запись в GitHub |

## Локальный просмотр

```bash
cd ~/Projects/popovichfit-tariffs
python3 -m http.server 8080
```

- http://localhost:8080/korrekciya.html
- http://localhost:8080/silovye.html
- http://localhost:8080/admin-korrekciya.html
- http://localhost:8080/admin-silovye.html
