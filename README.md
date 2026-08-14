# PopovichFit — виджет тарифов для Тильды

Статический виджет (HTML/CSS/JS) с админкой. Публичная страница встраивается в Тильду через iframe. Весь контент живёт в `config.json`.

- **Страница тарифов:** https://elenasamanchuk.github.io/popovichfit-tariffs/
- **Админка:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin.html
- **Локально:** `/Users/elena/Projects/popovichfit-tariffs`

## Как устроены обновления

1. Открываете админку.
2. Вставляете GitHub Personal Access Token с правом `repo` (хранится только в `localStorage` браузера, в репозиторий не попадает).
3. Правите цены, ссылки, тексты, картинки — справа живое превью.
4. Нажимаете **Сохранить в GitHub**. Админка коммитит `config.json` через GitHub Contents API.
5. GitHub Pages обновляет публичную страницу. Iframe на Тильде подтягивает новый `config.json` (`cache: no-store` + `?t=`).

### Как создать токен

GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token.

Нужный scope: **`repo`**.

## Как вставить на Тильду

1. В редакторе страницы добавьте блок **HTML-код (T123)**.
2. Вставьте содержимое файла [`tilda-embed.html`](tilda-embed.html).
3. Опубликуйте страницу.

Iframe сам пишет высоту родителю через `postMessage` (`popovich-tariffs-resize`). Попап подписки сообщает Тильде, что нужно затемнение и блок скролла (`popovich-tariffs-modal`) — тот же протокол, что у виджета оборудования Kochfit.

## Логика тарифов

Как на [popovichfit.ru/new-course](https://popovichfit.ru/new-course):

- В карточке 1 / 3 / 6 потоков — кнопка **Купить** открывает ссылку `lk.popovichfit.ru/payments/tariff_…/checkout`.
- Опция **Подписка** и кнопка плашки открывают новый попап из Figma.
- В попапе выбирается тариф подписки, кнопка ведёт на его ссылку (ссылки подписки пока пустые — пропишите в админке, когда появятся).

Стартовые цены и ссылки разовых тарифов взяты с живой страницы `/new-course` (`window.PF_CARDS`: `korekciya` / `korekciya-trener` — именно они сейчас крутятся на блоке «Силовой»).

## Файлы

| Файл | Назначение |
| --- | --- |
| `index.html` | Публичный виджет |
| `admin.html` | Админка |
| `config.json` | Весь контент |
| `tilda-embed.html` | Готовый HTML+JS для Тильды |
| `js/widget.js` | Рендер + postMessage |
| `js/admin.js` | Формы + GitHub API |

## Локальный просмотр

Откройте `index.html` или `admin.html` через любой статический сервер, например:

```bash
cd ~/Projects/popovichfit-tariffs
python3 -m http.server 8080
```

Админка: http://localhost:8080/admin.html
