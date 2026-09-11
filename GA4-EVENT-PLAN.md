# План подій GA4

Реалізація в app.js. analytics.js і Measurement ID G-YWB4VXZGJ2 не змінені.
До змін у коді були лише ініціалізація Google tag та автоматичний page_view.
session_start/first_visit збирає GA4 автоматично за відповідних умов.
Статус Enhanced measurement у ресурсі GA4 не перевірено.

| Подія | Умова | Параметри |
| --- | --- | --- |
| view_guide | Успішно відображена конкретна інструкція; не сторінка помилки | guide_id, guide_name, page_location |
| view_prompt | Текст відкритого промпта вперше потрапив у видиму область; один раз на prompt_id за завантаження документа | prompt_id, prompt_name, guide_id, page_location |
| copy_prompt | Клік на наявну кнопку копіювання, у її чинному handler | prompt_id, prompt_name, guide_id, page_location |
| file_download | Клік на «Завантажити PDF» | file_id, file_name, guide_id, file_url, page_location |
| outbound_click | Клік на зовнішнє HTTP(S)-посилання, крім позначеного завантаження | link_url, link_name, destination, page_location |

save_prompt не реалізована: функції збереження немає. Промпти вже розгорнуті, тому view_prompt означає видимість тексту, а не відкриття неіснуючого акордеона. Це не доказ прочитання. Без IntersectionObserver подія перегляду пропускається; копіювання працює.
copy_prompt вимірює спробу копіювання, включно з відмовою Clipboard API. file_download вимірює намір, не завершення скачування на Google Drive.
destination за замовчуванням — hostname, наприклад www.instagram.com; link_name — текст посилання. Для спеціальної назви можна додати data-destination/data-link-name до посилання.

## Одноразове налаштування GA4 перед публікацією

1. Admin → Data streams → потрібний Web stream → Enhanced measurement → налаштування: вимкнути **File downloads**, зберегти. Наш handler є єдиним джерелом file_download. Це особливо важливо для майбутніх URL з .pdf. У коді немає надійного способу перевірити цей серверний перемикач. Не вимикати page views.
2. Автоматичний Outbound clicks може створювати окрему подію click. Це інша назва; для цієї схеми користуватися outbound_click, не сумувати її з click. За бажанням автоматичний Outbound clicks можна вимкнути.
3. Перевірити, що правила Create/Modify events або інший тег не створюють копії цих подій. Створювати похідні події для кожного промпта не потрібно.
4. Позначити copy_prompt та file_download як Key events (counting: once per event). view_guide, view_prompt, page_view та outbound_click залишити звичайними. save_prompt розглянути тільки якщо колись з'явиться функція.

## Виміри звітності

Admin → Custom definitions → Create custom dimension; Scope = Event:

| Назва | Event parameter |
| --- | --- |
| Prompt ID | prompt_id |
| Prompt name | prompt_name |
| Guide ID | guide_id |
| Guide name | guide_name |
| Destination | destination |

file_name використовує стандартний параметр завантажень і стандартний вимір **File name** — спочатку використовуйте його, без дублювання custom dimension. За потреби file_id можна зареєструвати окремим Event-виміром. page_location також має стандартний вимір Page location.
guide_name надсилається у view_guide; у copy_prompt/view_prompt використовуйте guide_id для групування.
Дані custom dimensions для звітів зазвичай з'являються через 24–48 годин після реєстрації й отримання даних; не розраховуйте на ретроактивне заповнення історії.

## Тест після публікації

Опублікувати оновлений app.js через звичний процес GitHub Pages. Локальні зміни самі не оновлюють публічний сайт.
Увімкнути налагодження для тестового пристрою через https://tagassistant.google.com/; відкрити GA4 Admin → DebugView та вибрати пристрій. Постійний debug_mode у код не додано.

1. Відкрити головну сторінку з UTM: page_view; для нової сесії також session_start, для нового користувача можливий first_visit.
2. Відкрити інструкцію: page_view та один view_guide. Перевірити guide_id, guide_name, page_location.
3. Прокрутити до тексту промпта: один view_prompt з prompt_id, prompt_name, guide_id. Якщо текст уже на екрані, подія може прийти одразу. Повторне прокручування не дає другого перегляду.
4. Натиснути «Копіювати»: один copy_prompt на клік. Вставити текст у текстовий редактор та перевірити вміст. Другий окремий клік має дати другу подію.
5. Натиснути «Завантажити PDF»: один file_download з чотирма параметрами файлу. outbound_click для цього ж кліку не надсилається. Перевірити кількість після вимкнення автоматичних File downloads.
6. «Відкрити PDF», ChatGPT, Instagram або інше зовнішнє посилання: outbound_click. Внутрішній перехід не створює outbound_click.
7. Невідомий resource.html?id=missing: немає view_guide чи view_prompt. page_view сторінки залишається.

Realtime підходить для швидкої перевірки назв; точні параметри й одиничні спрацювання перевіряти в DebugView. Локальні автоматичні тести не є доказом отримання даних серверами GA4.

## Нові матеріали

Додавати матеріали, як раніше, у content/resources.json. Нова подія GA4 або listener не потрібні.
- guide_id = id інструкції; guide_name = title.
- prompt_name = title промпта. prompt_id = guide id + item.id, якщо вказано; інакше автоматичний хеш назви. Для однакових назв у межах інструкції вказуйте різні стабільні id. Для збереження ідентичності при перейменуванні також задайте id заздалегідь. Перестановка іменованих промптів не змінює автоматичний ID.
- file_id = fileId або guide id + :pdf; file_name = fileName або назва інструкції + .pdf. Це аналітична назва, не перевірена назва файлу на Drive.
- pdfDownloadUrl автоматично створює кнопку та її аналітичні data-атрибути. pdfViewUrl створює посилання перегляду. Нові домени зовнішніх ресурсів мають відповідати наявному allowedHosts у app.js; це чинне обмеження сайту, не GA4.

## Локальна перевірка

`node --test tests/analytics.test.cjs`

Перевіряє кліки, параметри, копіювання, відмови Clipboard/gtag, повторні перегляди, поточні матеріали та єдине підключення Google tag. Мережевих запитів до GA4 немає.

Документація Google:
- https://support.google.com/analytics/answer/14239696
- https://support.google.com/analytics/answer/7201382
- https://support.google.com/analytics/answer/9216061
