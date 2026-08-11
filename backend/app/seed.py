"""Идемпотентный seed демо-данных «Алые Паруса».
Тексты повторяют статический контент публичного сайта
(web/src/infrastructure/content/data/*.data.ts) — после перехода фронта на API
главная рендерится идентично. Заказчик правит всё через админку.
Чертежи планировок — плейсхолдеры из медиатеки (volume mediadata): после
полного сброса `down -v` картинки нужно перезалить, тексты останутся."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import (
    AdminUser, Advantage, AppSettings, Banner, CalculatorParams, Contacts,
    Document, Fact, Faq, Floorplan, HeroChapter, News, Partner, PlanCategory,
    SeoMeta, SiteText, TeamMember,
)
from .security import hash_password

# Чертежи планировок заказчик загружает сам через медиатеку админки:
# сидировать «заглушки» нельзя — на сайте это выглядело бы как битые картинки.
# Пустое image_url → аккуратное состояние «Чертёж скоро появится».

# ЧПУ-категории каталога (/planirovki/{slug}); description — вводный текст
# страницы категории (уникальный контент против «тонких» страниц фильтров)
PLAN_CATEGORIES = [
    dict(title="Студии", slug="studii", sort=10,
         description="<p>Компактные студии 26–31 м² на первой береговой линии — "
                     "формат для отдыха у моря и сдачи в аренду через управляющую "
                     "компанию. Эргономичные планировки с балконами и санузлами, "
                     "быстрый порог входа в курортную недвижимость.</p>"),
    dict(title="1-комнатные", slug="odnokomnatnye", sort=20,
         description="<p>1-комнатные апартаменты 40–71 м² с отдельной спальней и "
                     "просторными балконами. Баланс между личным отдыхом семьи и "
                     "доходной арендой: места хватает для жизни, а формат остаётся "
                     "ликвидным круглый год.</p>"),
    dict(title="2-комнатные", slug="dvuhkomnatnye", sort=30,
         description="<p>2-комнатные апартаменты до 74 м² с двумя спальнями и "
                     "видами на море — семейный формат первой линии Каспия. "
                     "Простор для постоянной жизни у воды и уверенная "
                     "капитализация по мере готовности квартала.</p>"),
]

# Плейсхолдеры-лоты 26–74 м² (категория задаётся слагом, резолвится при вставке)
FLOORPLANS = [
    dict(title="Студия 26,82 м²", slug="studiya-2682", _category="studii",
         area_m2=26.82, price=4290000, availability_status="available", sort=10,
         floor=3, ceiling_height=3.0,
         description="Жилая комната 18,48 м², санузел 3,70 м², балкон 4,64 м². "
                     "Вид на внутренний бульвар."),
    dict(title="1-комнатный 50,66 м²", slug="apartament-5066", _category="odnokomnatnye",
         area_m2=50.66, price=8100000, availability_status="available", sort=20,
         floor=5, ceiling_height=3.0,
         description="Жилая комната 17,71 м², спальня 13,50 м², прихожая 5,68 м², "
                     "санузел 4,63 м², балкон 9,14 м²."),
    dict(title="2-комнатный 73,51 м²", slug="apartament-7351", _category="dvuhkomnatnye",
         area_m2=73.51, price=11750000, availability_status="available", sort=30,
         floor=7, ceiling_height=3.0,
         description="Жилая комната 15,50 м², спальни 12,24 и 11,51 м², "
                     "прихожая 6,68 м², балконы 17,90 и 5,30 м². Вид на море."),
    dict(title="Студия 26,19 м²", slug="studiya-2619", _category="studii",
         area_m2=26.19, price=None, availability_status="available", sort=40,
         description="Жилая комната 17,85 м², санузел 3,63 м², балкон 4,71 м²."),
    dict(title="Студия 26,77 м²", slug="studiya-2677", _category="studii",
         area_m2=26.77, price=None, availability_status="available", sort=50,
         description="Жилая комната 18,01 м², санузел 4,05 м², балкон 4,71 м²."),
    dict(title="Студия 26,82 м² — вариант Б", slug="studiya-2682-b", _category="studii",
         area_m2=26.82, price=None, availability_status="reserved", sort=60,
         description="Зеркальная планировка. Жилая комната 18,48 м², санузел 3,70 м², "
                     "балкон 4,64 м²."),
    dict(title="Студия 31,23 м²", slug="studiya-3123", _category="studii",
         area_m2=31.23, price=None, availability_status="available", sort=70,
         description="Жилая комната 22,17 м², санузел 4,25 м², балкон 4,81 м²."),
    dict(title="Студия 31,23 м² — вариант Б", slug="studiya-3123-b", _category="studii",
         area_m2=31.23, price=None, availability_status="available", sort=80,
         description="Зеркальная планировка. Жилая комната 22,17 м², санузел 4,25 м², "
                     "балкон 4,81 м²."),
    dict(title="1-комнатный 40,95 м²", slug="apartament-4095", _category="odnokomnatnye",
         area_m2=40.95, price=None, availability_status="available", sort=90,
         description="Жилая комната 23,34 м², прихожая 4,23 м², санузел 5,30 м², "
                     "балкон 8,08 м²."),
    dict(title="1-комнатный 70,99 м²", slug="apartament-7099", _category="odnokomnatnye",
         area_m2=70.99, price=None, availability_status="available", sort=100,
         description="Жилая комната 26,97 м², спальня 12,58 м², прихожая 4,74 м², "
                     "санузел 4,09 м², балконы 17,90 и 4,71 м²."),
]


def _get_or_create_singleton(db: Session, model, **defaults):
    obj = db.get(model, 1)
    if obj is None:
        obj = model(id=1, **defaults)
        db.add(obj)
    return obj


def seed(db: Session) -> None:
    # ── Админ-пользователи (З12) ──
    if not db.scalar(select(AdminUser).where(AdminUser.email == settings.seed_superadmin_email)):
        db.add(AdminUser(
            email=settings.seed_superadmin_email,
            password_hash=hash_password(settings.seed_superadmin_password),
            role="admin",
        ))
    if not db.scalar(select(AdminUser).where(AdminUser.email == settings.seed_manager_email)):
        db.add(AdminUser(
            email=settings.seed_manager_email,
            password_hash=hash_password(settings.seed_manager_password),
            role="manager",
        ))

    # ── Настройки (З6: цены показываем) ──
    _get_or_create_singleton(db, AppSettings, show_prices=True, notify_channel=settings.notify_channel)

    # ── Hero / Баннер (тексты первого экрана и CTA; постер — статика фронта) ──
    _get_or_create_singleton(
        db, Banner,
        eyebrow="Первая линия Каспия",
        title="Алые Паруса",
        subtitle="Апарт-комплекс на первой береговой линии Каспийского моря",
        cta_primary_label="Забронировать апартамент",
        cta_primary_target="#contact",
        cta_secondary_label="Планировки",
        cta_secondary_target="/planirovki",
    )

    # ── Контакты (телефон/мессенджеры заполнит заказчик — З24/З27) ──
    _get_or_create_singleton(
        db, Contacts,
        address="Республика Дагестан, Карабудахкентский район, "
                "первая береговая линия Каспийского моря (напротив аэропорта Махачкалы)",
        work_hours="Пн–Вс, 9:00–18:00",
        cadastral_number="05:09:000045:476",
    )

    # ── Категории планировок (бэкфилл description для существующих строк) ──
    existing_cats = {c.slug: c for c in db.scalars(select(PlanCategory)).all()}
    for cat in PLAN_CATEGORIES:
        obj = existing_cats.get(cat["slug"])
        if obj is None:
            db.add(PlanCategory(**cat))
        elif obj.description is None and cat.get("description"):
            obj.description = cat["description"]
    db.flush()
    cat_by_slug = {c.slug: c.id for c in db.scalars(select(PlanCategory)).all()}

    # ── Планировки (плейсхолдеры; заказчик дополнит через админку — З20) ──
    existing_slugs = set(db.scalars(select(Floorplan.slug)).all())
    for fp in FLOORPLANS:
        if fp["slug"] not in existing_slugs:
            row = {k: v for k, v in fp.items() if k != "_category"}
            row["category_id"] = cat_by_slug.get(fp["_category"])
            db.add(Floorplan(**row))

    db.commit()
    seed_content(db)


def _seed_list(db: Session, model, rows: list[dict], key: str):
    """Идемпотентно добавляет строки, каких ещё нет (по естественному ключу).
    Для существующих — бэкфилл новых nullable-полей (напр. category),
    если в БД они ещё пустые: демо-контент догоняет эволюцию схемы."""
    existing = {getattr(o, key): o for o in db.scalars(select(model)).all()}
    for r in rows:
        obj = existing.get(r[key])
        if obj is None:
            db.add(model(**r))
        else:
            for field, value in r.items():
                if getattr(obj, field, None) is None and value is not None:
                    setattr(obj, field, value)


def seed_content(db: Session) -> None:
    """Наполнение блоков — контент главной страницы «Алые Паруса»."""
    now = datetime.now(timezone.utc)

    # ── Факты: ленты главной (about / trust / nearby / investment) ──
    _seed_list(db, Fact, [
        # «О комплексе» — цифры проекта
        dict(group="about", value="46", label="корпусов", sort=10),
        dict(group="about", value="11", label="гектаров", note="площадь квартала", sort=20),
        dict(group="about", value="750 м", label="центральная аллея", sort=30),
        dict(group="about", value="9", label="этажей", sort=40),
        dict(group="about", value="22–79", label="м² · апартаменты", sort=50),
        dict(group="about", value="1-я", label="линия у моря", sort=60),
        # «Надёжность» — инвесторское доверие
        dict(group="trust", value="Эскроу · 214-ФЗ", label="Защита средств", sort=10),
        dict(group="trust", value="05:09:000045:476", label="Кадастр участка", sort=20),
        dict(group="trust", value="Cherkesov Group", label="Застройщик", sort=30),
        dict(group="trust", value="бюро ФОРМА", label="Архитектура", sort=40),
        dict(group="trust", value="кирпич-монолит", label="Технология", sort=50),
        # «Всё рядом» — только подтверждённые минуты
        dict(group="nearby", value="8 минут", label="Школа", sort=10),
        dict(group="nearby", value="8 минут", label="Детский сад", sort=20),
        dict(group="nearby", value="первая линия", label="Пляж", sort=30),
        dict(group="nearby", value="750 метров", label="Аллея", sort=40),
        dict(group="nearby", value="напротив", label="Аэропорт", sort=50),
        # «Инвестиции» — метрики
        dict(group="investment", value="от 3 лет", label="окупаемость", sort=10),
        dict(group="investment", value="под ключ", label="аренда через УК",
             note="пассивный доход без забот", sort=20),
        dict(group="investment", value="1-я линия", label="курортный спрос",
             note="аренда круглый год", sort=30),
        dict(group="investment", value="от 22 м²", label="порог входа",
             note="компактные апартаменты", sort=40),
    ], "label")

    # ── Тексты секций главной ──
    _seed_list(db, SiteText, [
        dict(key="identity", title="АЛЫЕ ПАРУСА",
             lead="Апарт-комплекс на первой береговой линии Каспийского моря", sort=5),
        dict(key="about", eyebrow="О комплексе",
             title="Город у моря, продуманный для жизни",
             lead="Апарт-комплекс на первой береговой линии Каспийского моря", sort=10),
        dict(key="trust_band", title="Надёжность", sort=15),
        dict(key="location", eyebrow="Локация", title="Первая линия Каспия",
             lead="Республика Дагестан, Карабудахкентский район", sort=20),
        dict(key="nearby_band", title="Всё рядом", sort=25),
        dict(key="infrastructure", eyebrow="Инфраструктура",
             title="Курорт в двух шагах от дома",
             lead="Всё для отдыха и жизни — внутри квартала, без машины.", sort=30),
        dict(key="scroll_story", eyebrow="Жизнь у моря", sort=35),
        dict(key="residences", eyebrow="Апартаменты",
             title="Форматы под жизнь и под доход", sort=40),
        dict(key="floorplans", eyebrow="Каталог", title="Планировки",
             lead="Студии и апартаменты 22–79 м² — выберите свой формат у моря.", sort=45),
        dict(key="calculator", eyebrow="Рассрочка", title="Рассчитайте свой платёж",
             lead="Гибкий первоначальный взнос и срок — узнайте ежемесячный платёж за минуту.",
             sort=50),
        dict(key="investment", eyebrow="Инвестиции", title="Актив у моря, который растёт",
             lead="Апартаменты у моря — актив, который работает: сдача через управляющую "
                  "компанию и рост капитализации по мере готовности квартала.\n\n"
                  "Первая береговая линия Каспия и курортный формат обеспечивают спрос "
                  "на аренду в течение всего года.", sort=55),
        dict(key="news", eyebrow="Новости", title="Жизнь проекта", sort=60),
        dict(key="team", eyebrow="Команда", title="Люди, которые строят город у моря", sort=65),
        dict(key="faq", eyebrow="Вопросы", title="Отвечаем на главное", sort=70),
        dict(key="partners", eyebrow="Партнёры", title="Кто создаёт «Алые Паруса»", sort=75),
        dict(key="cta", eyebrow="Cherkesov Group", title="Забронируйте апартамент у моря",
             lead="Оставьте заявку — менеджер BUYHOUSE свяжется с вами и подберёт формат.",
             sort=80),
    ], "key")

    # ── Главы скролл-hero (тайминги — статика фронта, зипуются по sort) ──
    _seed_list(db, HeroChapter, [
        dict(eyebrow="Первая линия Каспия", title="Алые Паруса",
             subtitle="Есть море. И есть тот, кто ждёт на берегу.", sort=10),
        dict(eyebrow="Дагестан · напротив аэропорта", title="Здесь чудо строят руками",
             subtitle="Кирпично-монолитные корпуса поднимаются у самой воды.", sort=20),
        dict(eyebrow="Масштаб", title="Город вырастает на берегу",
             subtitle="46 корпусов · 11 гектаров · аллея 750 метров", sort=30),
        dict(eyebrow="Квартал готов", title="Корабль вошёл в бухту",
             subtitle="9 этажей · апартаменты 22–79 м² · школа в 8 минутах", sort=40),
        dict(eyebrow="Курорт", title="Курорт, в котором живут",
             subtitle="Бульвар · два бассейна · пляж первой линии", sort=50),
        dict(eyebrow="Инвестиция", title="Мечта, которая растёт в цене",
             subtitle="Аренда через управляющую компанию · окупаемость от 3 лет", sort=60),
    ], "title")

    # ── Преимущества (карточки «О комплексе» и «Инфраструктура») ──
    _seed_list(db, Advantage, [
        dict(title="Город в городе", category="living", sort=10,
             text="Замкнутая инфраструктура квартала: всё для жизни — в пределах пешей прогулки."),
        dict(title="Школа и детский сад", category="living", sort=20,
             text="Образование рядом с домом — школа в 8 минутах."),
        dict(title="Аллея 750 метров", category="living", sort=30,
             text="Центральный пешеходный бульвар через весь квартал к морю."),
        dict(title="Управляющая компания", category="living", sort=40,
             text="Сервис, обслуживание и аренда апартаментов под ключ."),
        dict(title="Два бассейна", category="leisure", sort=50,
             text="Открытые бассейны у корпусов и на набережной."),
        dict(title="Пляж первой линии", category="leisure", sort=60,
             text="Собственный выход к морю и песчаный пляж."),
        dict(title="Набережная и пирс", category="leisure", sort=70,
             text="Прогулочная набережная, пирс и озеро внутри квартала."),
        dict(title="Коммерция у дома", category="infrastructure", sort=80,
             text="Рестораны, кофейни, аптеки и сервисы на первых этажах."),
        dict(title="Бульвар и зелёные дворы", category="infrastructure", sort=90,
             text="Благоустроенные дворы без машин и прогулочные зоны."),
    ], "title")

    # ── Партнёры (бренды проекта — выводятся на главной и в футере) ──
    _seed_list(db, Partner, [
        dict(name="CHERKESOV GROUP", sort=10, description="Застройщик"),
        dict(name="BUYHOUSE", sort=20, description="Официальные продажи"),
        dict(name="ФОРМА", sort=30, description="Архитектурное бюро"),
    ], "name")

    # ── Команда — заполняет заказчик (блок скрыт, пока список пуст) ──
    _seed_list(db, TeamMember, [], "name")

    _seed_list(db, Faq, [
        dict(question="Как работает рассрочка?", sort=10,
             answer="<p>Первоначальный взнос — от 30 % стоимости апартамента, срок — до "
                    "36 месяцев. Рассчитайте ежемесячный платёж в калькуляторе на главной "
                    "странице и оставьте заявку — менеджер подберёт удобный график.</p>"),
        dict(question="Можно ли сдавать апартаменты в аренду?", sort=20,
             answer="<p>Да. Управляющая компания берёт аренду на себя: заселение гостей, "
                    "уборку и обслуживание. Первая береговая линия обеспечивает курортный "
                    "спрос круглый год, окупаемость — от 3 лет.</p>"),
        dict(question="Какие варианты отделки доступны?", sort=30,
             answer="<p>Три формата: черновая — под собственный дизайн-проект, White Box — "
                    "стены, стяжка и разводка готовы, и готовый ремонт — заезжай и живи "
                    "или сдавай с первого дня.</p>"),
    ], "question")

    _seed_list(db, News, [
        dict(title="Старт продаж апартаментов у моря",
             slug="start-prodazh", sort=10,
             excerpt="Открыты продажи студий и апартаментов 22–79 м² на первой береговой "
                     "линии Каспийского моря.",
             body="<p>Открыты продажи апартаментов комплекса «Алые Паруса»: студии и "
                  "апартаменты 22–79 м² в кирпично-монолитных корпусах на первой "
                  "береговой линии Каспия.</p><p>Доступна рассрочка с первоначальным "
                  "взносом от 30 %. Выберите планировку в каталоге и оставьте заявку — "
                  "менеджер подберёт формат под ваши задачи.</p>",
             published_at=now),
        dict(title="Квартал растёт: 46 корпусов на 11 гектарах",
             slug="kvartal-rastet", sort=20,
             excerpt="Кирпично-монолитные корпуса поднимаются у самой воды — рассказываем, "
                     "как устроен масштаб проекта.",
             body="<p>«Алые Паруса» — это 46 корпусов высотой 9 этажей на 11 гектарах "
                  "первой береговой линии, центральная аллея длиной 750 метров, два "
                  "бассейна и собственный пляж.</p><p>Школа и детский сад — в 8 минутах "
                  "от квартала, аэропорт Махачкалы — напротив.</p>",
             published_at=now),
    ], "slug")

    _seed_list(db, Document, [
        dict(title="Политика конфиденциальности", slug="politika-konfidencialnosti",
             doc_type="policy", is_policy=True, sort=5,
             description="<p>Как мы обрабатываем персональные данные из форм заявок: "
                         "цели, сроки, права субъекта (152-ФЗ).</p>"),
        dict(title="Разрешение на строительство", slug="razreshenie-na-stroitelstvo",
             doc_type="permit", sort=10,
             description="<p>Официальное разрешение на строительство комплекса. "
                         "Подтверждает законность работ на участке 05:09:000045:476.</p>"),
        dict(title="Проектная декларация", slug="proektnaya-deklaraciya",
             doc_type="declaration", sort=20,
             description="<p>Ключевой документ проекта: застройщик, сроки, характеристики "
                         "объекта и финансовые показатели.</p>"),
        dict(title="Наш.дом.рф — карточка объекта", slug="nash-dom-rf",
             doc_type="link", sort=30, url="https://наш.дом.рф",
             description="<p>Карточка объекта в единой государственной системе "
                         "жилищного строительства.</p>"),
    ], "slug")

    # ── Калькулятор рассрочки (доли 0..1; 0 = беспроцентная) ──
    if db.get(CalculatorParams, 1) is None:
        db.add(CalculatorParams(
            id=1, min_down_payment_pct=0.30, max_down_payment_pct=0.90,
            term_min_months=6, term_max_months=36, term_step_months=6,
            markup_pct_annual=0.0, price_per_m2=160000,
            disclaimer="Расчёт рассрочки носит предварительный характер и не является "
                       "публичной офертой (ст. 437 ГК РФ). Итоговые условия — цена лота, "
                       "график платежей и удорожание — фиксируются договором.",
        ))

    _seed_list(db, SeoMeta, [
        dict(slug="/", title="Алые Паруса — апарт-комплекс на первой линии Каспия",
             description="Апарт-комплекс «Алые Паруса» на первой береговой линии "
                         "Каспийского моря, Дагестан. 46 корпусов, апартаменты 22–79 м², "
                         "рассрочка от 30 %, аренда через УК."),
        dict(slug="/planirovki", title="Планировки — Алые Паруса",
             description="Каталог планировок: студии и апартаменты 22–79 м² на первой "
                         "береговой линии Каспия. Рассрочка с первоначальным взносом от 30 %."),
        dict(slug="/dokumenty", title="Документы — Алые Паруса",
             description="Разрешение на строительство, проектная декларация и другие "
                         "документы апарт-комплекса «Алые Паруса»."),
        dict(slug="/novosti", title="Новости — Алые Паруса",
             description="Новости апарт-комплекса «Алые Паруса»: ход проекта, старт "
                         "продаж, условия рассрочки."),
    ], "slug")

    db.commit()
