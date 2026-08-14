# PopovichFit — виджет тарифов для Тильды

Две отдельные публичные страницы (два iframe) и две отдельные админки. Контент живёт в JSON и публикуется через GitHub Pages.

## Публичные страницы

- **Коррекция:** https://elenasamanchuk.github.io/popovichfit-tariffs/korrekciya.html
- **Силовые:** https://elenasamanchuk.github.io/popovichfit-tariffs/silovye.html
- **Выбор курса:** https://elenasamanchuk.github.io/popovichfit-tariffs/ (старый `/` больше не один виджет)

## Админки

Каждая админка правит **только свой** файл и коммитит его в `main` через GitHub Contents API. Превью справа — черновик в браузере. Живая страница и iframe на Тильде меняются только после **«Сохранить в GitHub»**.

- **Админка коррекции:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin-korrekciya.html → `config-korrekciya.json`
- **Админка силовых:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin-silovye.html → `config-silovye.json`
- **Выбор админки:** https://elenasamanchuk.github.io/popovichfit-tariffs/admin.html

Черновики не пересекаются: `PF_ADMIN_DRAFT_korrekciya` и `PF_ADMIN_DRAFT_silovye`.

### Как сохранить изменение

1. Откройте нужную админку.
2. Вставьте GitHub Personal Access Token с правом `repo` (хранится только в `localStorage` браузера).
3. Правите цены, ссылки, тексты — справа превью.
4. Нажмите **Сохранить в GitHub**. Админка записывает JSON в репозиторий.
5. GitHub Pages пересобирает сайт. Виджет грузит конфиг с `cache: no-store` и `?t=`.

Нужный scope токена: **`repo`**.

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
| `tilda-embed-korrekciya.html` | Готовый HTML+JS для Тильды, коррекция |
| `tilda-embed-silovye.html` | Готовый HTML+JS для Тильды, силовые |
| `js/widget.js` | Рендер, читает `data-config` |
| `js/admin.js` | Формы + запись в GitHub |

## Локальный просмотр

```bash
cd ~/Projects/popovichfit-tariffs
python3 -m http.server 8080
```

- http://localhost:8080/korrekciya.html
- http://localhost:8080/silovye.html
- http://localhost:8080/admin-korrekciya.html
- http://localhost:8080/admin-silovye.html
