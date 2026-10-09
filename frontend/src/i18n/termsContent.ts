import type { LocaleCode } from "./types";

export type TermsBullet = string | { strong: string; text: string };

export type TermsSection = {
  title?: string;
  danger?: boolean;
  paragraphs?: string[];
  bullets?: TermsBullet[];
  /** Rendered after bullets/table (e.g. caveats under a limits table). */
  paragraphsAfter?: string[];
  table?: {
    headers: [string, string] | [string, string, string];
    rows: Array<{
      level: string;
      amount: string;
      unit: string;
      monthly?: string;
    }>;
  };
};

export type TermsDoc = {
  docTitle: string;
  lastUpdated: string;
  sections: TermsSection[];
  endNote: string;
};

const TERMS_FA: TermsDoc = {
  docTitle: "شرایط و مقررات استفاده از پلتفرم تومانیت",
  lastUpdated: "آخرین به‌روزرسانی: ۱ مهر ۱۴۰۵",
  sections: [
    {
      paragraphs: [
        "ورود به مینی اپلیکیشن، ایجاد حساب کاربری، یا استفاده از هر یک از خدمات تومانیت، اعم از ربات‌ها، وب‌سرویس‌ها و سایر اجزای سامانه، به‌منزله آگاهی کامل از مفاد این سند و پذیرش بی‌قید و شرط آن است. کاربر مکلف است پیش از بهره‌برداری از خدمات، متن حاضر را به‌دقت مطالعه نماید.",
        "تومانیت حق دارد در راستای الزامات قانونی، امنیتی، فنی یا عملیاتی، مفاد این مقررات و سقف‌های معاملاتی را اصلاح یا به‌روزرسانی کند. ادامه استفاده از خدمات پس از اعمال تغییرات، به‌منزله پذیرش نسخه جدید خواهد بود.",
      ],
    },
    {
      title: "۱. تعاریف",
      paragraphs: ["در این مقررات، اصطلاحات زیر با معانی مشروح به‌کار رفته‌اند:"],
      bullets: [
        {
          strong: "پلتفرم / تومانیت:",
          text:
            "مجموعه سامانه‌ها، مینی اپلیکیشن، ربات‌ها، وب‌سرویس‌ها و سایر خدماتی که تحت نام تومانیت ارائه می‌شود.",
        },
        {
          strong: "کاربر:",
          text: "هر شخص حقیقی یا حقوقی که از خدمات پلتفرم استفاده می‌کند.",
        },
        {
          strong: "احراز هویت:",
          text: "فرآیند بررسی و تأیید هویت کاربر طبق رویه‌ها و الزامات پلتفرم.",
        },
        {
          strong: "تراکنش:",
          text:
            "هرگونه خرید، فروش، انتقال، پرداخت، برداشت، دریافت یا تبدیل دارایی از طریق پلتفرم.",
        },
        {
          strong: "دارایی دیجیتال:",
          text:
            "رمزارزها و سایر دارایی‌های دیجیتالی که در هر زمان در فهرست پشتیبانی پلتفرم قرار دارند.",
        },
        {
          strong: "درگاه پرداخت رمزارزی:",
          text:
            "خدماتی که امکان صدور فاکتور، دریافت وجه رمزارزی و بهره‌برداری از وب‌سرویس را برای کسب‌وکارها فراهم می‌کند.",
        },
      ],
    },
    {
      title: "۲. شرایط عمومی استفاده",
      bullets: [
        "بهره‌برداری از خدمات صرفاً برای اشخاصی مجاز است که به‌موجب قوانین جاری صلاحیت استفاده از این‌گونه خدمات را دارند.",
        "صحت، کامل بودن و به‌روز بودن کلیه اطلاعاتی که کاربر در اختیار پلتفرم قرار می‌دهد بر عهده خود اوست.",
        "ایجاد حساب یا استفاده از خدمات با اطلاعات هویتی شخص ثالث، مدارک مجعول یا هرگونه مشخصات غیرواقعی ممنوع است.",
        "هر حساب کاربری باید تحت کنترل و مسئولیت همان شخصی باشد که اطلاعات آن حساب به نام وی ثبت شده است.",
        "واگذاری، فروش، اجاره یا انتقال حساب کاربری به غیر مطلقاً ممنوع است.",
        "کاربر مکلف است اطلاعات ورود، رمز عبور، کدهای تأیید و سایر داده‌های امنیتی خود را محرمانه نگاه دارد.",
        "پلتفرم مجاز است به منظور حفظ امنیت کاربران یا رعایت الزامات قانونی، دسترسی به برخی خدمات یا حساب‌ها را به‌طور موقت یا دائم محدود، تعلیق یا مسدود نماید.",
      ],
    },
    {
      title: "۳. سطوح احراز هویت و سقف تراکنش",
      paragraphs: [
        "به‌منظور مدیریت ریسک، پیشگیری از سوءاستفاده و رعایت الزامات عملیاتی، سقف مجموع عملیات مالی مجاز بر اساس سطح احراز هویت کاربر به شرح جدول زیر تعیین می‌گردد:",
      ],
      table: {
        headers: ["سطح احراز", "سقف روزانه", "سقف ۳۰ روزه"],
        rows: [
          {
            level: "سطح پایه (بدون احراز)",
            amount: "۵۰۰٬۰۰۰",
            unit: "تومان",
            monthly: "۵٬۰۰۰٬۰۰۰",
          },
          {
            level: "سطح ۱",
            amount: "۵٬۰۰۰٬۰۰۰",
            unit: "تومان",
            monthly: "۱۰۰٬۰۰۰٬۰۰۰",
          },
          {
            level: "سطح ۲",
            amount: "۵۰٬۰۰۰٬۰۰۰",
            unit: "تومان",
            monthly: "۱٬۰۰۰٬۰۰۰٬۰۰۰",
          },
        ],
      },
      paragraphsAfter: [
        "سقف‌های فوق، حدود عملیاتی داخلی پلتفرم محسوب می‌شوند و بسته به نوع عملیات، نوع دارایی، شیوه پرداخت، وضعیت حساب، ارزیابی ریسک، مقررات لازم‌الاجرا یا تصمیمات امنیتی پلتفرم، قابل کاهش یا افزایش‌اند. پس از واریز ریالی، برداشت رمزارز تا ۷۲ ساعت مشمول محدودیت امنیتی است؛ واریز و برداشت رمزارزی مشمول این قفل نیست. پلتفرم می‌تواند حتی در صورت قرار داشتن کاربر در محدوده سقف مجاز، احراز هویت تکمیلی یا بررسی مضاعف درخواست نماید.",
      ],
    },
    {
      title: "۴. احراز هویت",
      bullets: [
        "ارائه یا ادامه برخی خدمات منوط به تکمیل موفقیت‌آمیز فرآیند احراز هویت است.",
        "اطلاعات و مدارک هویتی باید منحصراً متعلق به خود کاربر باشد.",
        "ارائه اطلاعات ناقص، نادرست یا متعلق به غیر، موجب توقف فرآیند احراز هویت یا اعمال محدودیت بر حساب خواهد شد.",
        "پلتفرم مجاز است در صورت ضرورت، مدارک یا اطلاعات تکمیلی مطالبه کند.",
        "تکمیل احراز هویت به‌معنای تضمین انجام کلیه تراکنش‌ها یا معافیت از محدودیت‌های امنیتی نیست.",
        "اطلاعات هویتی صرفاً در چارچوب قوانین، سیاست حریم خصوصی و الزامات امنیتی پلتفرم پردازش می‌شود.",
      ],
    },
    {
      title: "۵. مقررات پرداخت ریالی",
      bullets: [
        "پرداخت‌های ریالی صرفاً از طریق روش‌ها و حساب‌های مورد تأیید پلتفرم مجاز است.",
        "استفاده از کارت بانکی، حساب یا ابزار پرداخت متعلق به شخص ثالث می‌تواند موجب توقف یا بررسی تراکنش گردد.",
        "در صورت احراز مغایرت میان مشخصات پرداخت‌کننده و صاحب حساب، پلتفرم تا تعیین تکلیف، تراکنش را متوقف می‌کند.",
        "به‌کارگیری روش‌های پرداخت غیرمجاز، پرداخت‌های مشکوک، درج اطلاعات مجعول یا هرگونه تلاش برای دور زدن محدودیت‌های پرداخت ممنوع است.",
        "مسئولیت صحت اطلاعات واردشده هنگام پرداخت بر عهده کاربر است.",
        "در صورت بروز خطای بانکی، اختلال شبکه پرداخت یا عدم ثبت صحیح تراکنش، وضعیت نهایی بر مبنای سوابق سامانه و اطلاعات دریافتی از ارائه‌دهندگان خدمات پرداخت تعیین می‌شود.",
      ],
    },
    {
      title: "۶. مبارزه با پول‌شویی و فعالیت‌های غیرمجاز",
      paragraphs: ["هرگونه بهره‌برداری از پلتفرم برای موارد زیر اکیداً ممنوع است:"],
      bullets: [
        "پول‌شویی و تأمین مالی فعالیت‌های غیرقانونی",
        "کلاهبرداری، سرقت، فیشینگ و جرائم مرتبط",
        "سرقت اطلاعات بانکی یا خرید و فروش اطلاعات کارت بانکی",
        "استفاده از وجوه حاصل از جرم",
        "دور زدن محدودیت‌های قانونی یا مالی",
        "استفاده از حساب غیر یا ایجاد حساب‌های متعدد به‌قصد دور زدن محدودیت‌ها",
        "انجام تراکنش‌های صوری یا ساختگی",
        "هر عمل مغایر با قوانین و مقررات جاری کشور",
      ],
      paragraphsAfter: [
        "پلتفرم مجاز است تراکنش‌هایی را که از نظر فنی، مالی یا رفتاری غیرعادی یا مشکوک تشخیص دهد، برای بررسی بیشتر متوقف کند و تا پایان بررسی، ارائه برخی خدمات را محدود نماید.",
      ],
    },
    {
      title: "۷. تراکنش‌های مشکوک",
      paragraphs: [
        "در صورت مشاهده مواردی از قبیل حجم غیرمتعارف تراکنش‌ها، افزایش ناگهانی فعالیت حساب، الگوی چندحسابی غیرعادی، تلاش برای عبور از سقف‌های معاملاتی، ارتباط با منابع یا مقاصد پرریسک، مغایرت میان اطلاعات هویتی و مالی، دریافت یا ارسال وجه از اشخاص متعدد بدون توجیه مشخص، یا سایر الگوهای رفتاری مشکوک، پلتفرم می‌تواند نسبت به مطالبه مدارک تکمیلی، محدودیت موقت حساب، توقف تراکنش، بررسی منشأ وجوه و سایر اقدامات احتیاطی لازم اقدام کند.",
      ],
    },
    {
      title: "۸. سیاست ضد فیشینگ و کلاهبرداری",
      paragraphs: [
        "تومانیت هیچ‌گاه از طریق پیام خصوصی یا کانال‌های غیررسمی موارد زیر را از کاربر درخواست نمی‌کند: رمز عبور، کد ورود، کد تأیید پیامکی یا تلگرام، عبارت بازیابی کیف پول، کلید خصوصی (Private Key)، اطلاعات کامل کارت بانکی، رمز دوم یا CVV2، و نیز انتقال وجه به نشانی‌هایی که از طریق حساب‌های ناشناس اعلام شده‌اند.",
        "کاربر مکلف است پیش از هرگونه پرداخت یا انتقال دارایی دیجیتال، مقصد و مشخصات تراکنش را به‌دقت راستی‌آزمایی کند. خسارات ناشی از انتقال وجه به اشخاص یا نشانی‌هایی خارج از فرآیند رسمی پلتفرم، اعم از فریب، فیشینگ یا قصور کاربر، متوجه پلتفرم نخواهد بود؛ مگر در مواردی که به‌موجب قوانین لازم‌الاجرا مسئولیت مستقیمی بر عهده پلتفرم ثابت شود.",
      ],
    },
    {
      title: "۹. کانال‌های رسمی",
      paragraphs: [
        "کاربر موظف است خدمات و اطلاعیه‌های پلتفرم را صرفاً از طریق کانال‌ها و نشانی‌های رسمی اعلام‌شده دریافت کند. صرف معرفی یک حساب، ربات، کانال، وب‌سایت یا شخص به‌عنوان نماینده تومانیت، دلالت بر رسمیت آن ندارد. پیش از ارسال وجه یا افشای اطلاعات حساس، اصالت مقصد باید احراز گردد.",
      ],
    },
    {
      title: "۱۰. تراکنش‌های رمزارزی",
      bullets: [
        "تراکنش‌های ارسال‌شده به شبکه بلاکچین، بسته به وضعیت شبکه، غالباً غیرقابل بازگشت‌اند.",
        "انتخاب صحیح شبکه، نشانی مقصد و نوع دارایی بر عهده و مسئولیت کاربر است.",
        "ارسال دارایی بر روی شبکه نادرست ممکن است به از دست رفتن دائمی آن دارایی منجر شود.",
        "پلتفرم مسئولیتی در قبال تراکنش‌هایی که کاربر به نشانی یا شبکه اشتباه ارسال کرده است ندارد؛ مگر در حدودی که قوانین لازم‌الاجرا مقرر داشته‌اند.",
        "زمان تأیید تراکنش تابع شرایط شبکه، تعداد تأییدهای مورد نیاز، ازدحام و سایر عوامل فنی است.",
        "کارمزد شبکه و هزینه‌های مرتبط ممکن است از مبلغ تراکنش کسر یا به‌صورت جداگانه دریافت شود.",
      ],
    },
    {
      title: "۱۱. قیمت و نرخ تبدیل",
      paragraphs: [
        "نرخ خرید، فروش یا تبدیل دارایی‌ها توسط پلتفرم تعیین و در لحظه انجام عملیات به کاربر نمایش داده می‌شود. با توجه به نوسان بازار، نرخ ممکن است در فاصله میان مشاهده قیمت و تکمیل عملیات تغییر کند. چنانچه نرخ برای بازه زمانی مشخصی قفل شده باشد، همان نرخ تا پایان مدت اعلام‌شده معتبر خواهد بود.",
      ],
    },
    {
      title: "۱۲. لغو، استرداد و اصلاح تراکنش",
      paragraphs: [
        "پس از ثبت و ارسال تراکنش رمزارزی به شبکه، امکان لغو آن ممکن است وجود نداشته باشد. در مواردی که تراکنش هنوز پردازش نشده یا استرداد طبق فرآیندهای داخلی پلتفرم مقدور باشد، درخواست کاربر بررسی خواهد شد. هرگونه بازپرداخت منوط به بررسی منشأ وجه، سوابق تراکنش و وضعیت حساب است و هزینه‌های شبکه یا هزینه‌های عملیاتی مربوط، در صورت وجود، ممکن است از مبلغ بازپرداخت کسر گردد.",
      ],
    },
    {
      title: "۱۳. امنیت حساب کاربری",
      paragraphs: ["کاربر مکلف است:"],
      bullets: [
        "اطلاعات ورود خود را در اختیار دیگران قرار ندهد؛",
        "از دستگاه‌ها و بسترهای امن استفاده کند؛",
        "از طریق پیوندهای ناشناس یا غیررسمی وارد حساب نشود؛",
        "کدهای ورود و تأیید را برای دیگران ارسال نکند؛",
        "در صورت مشاهده هرگونه فعالیت مشکوک، فوراً موضوع را به پشتیبانی گزارش دهد.",
      ],
      paragraphsAfter: [
        "در صورت وجود قرائن دسترسی غیرمجاز، پلتفرم مجاز است برای صیانت از دارایی‌های کاربر، عملیات حساب را موقتاً محدود کند.",
      ],
    },
    {
      title: "۱۴. چندحسابی و دور زدن محدودیت‌ها",
      paragraphs: [
        "ایجاد یا اداره چند حساب به‌قصد دور زدن سقف تراکنش یا الزامات احراز هویت، تقسیم تراکنش‌ها، استفاده از هویت اشخاص ثالث، سوءاستفاده از طرح‌های تشویقی، یا پنهان‌سازی منشأ یا مقصد واقعی وجوه ممنوع است. پلتفرم می‌تواند حساب‌های مرتبط را بررسی کرده و در صورت لزوم محدود یا مسدود نماید.",
      ],
    },
    {
      title: "۱۵. درگاه پرداخت رمزارزی برای کسب‌وکارها",
      paragraphs: [
        "کسب‌وکارهایی که از وب‌سرویس یا درگاه پرداخت پلتفرم استفاده می‌کنند مکلف‌اند:",
      ],
      bullets: [
        "اطلاعات صحیح و به‌روز کسب‌وکار خود را ارائه دهند؛",
        "از وب‌سرویس صرفاً در چارچوب فعالیت‌های مجاز استفاده کنند؛",
        "اطلاعات فاکتور را به‌درستی ثبت کنند و از صدور فاکتور صوری خودداری نمایند؛",
        "کلید وب‌سرویس و سایر اطلاعات دسترسی را محرمانه نگاه دارند؛",
        "از درگاه برای هیچ فعالیت غیرقانونی استفاده نکنند.",
      ],
      paragraphsAfter: [
        "در صورت مشاهده فعالیت مشکوک، پلتفرم می‌تواند کلید وب‌سرویس، حساب یا فاکتورهای مربوطه را موقتاً غیرفعال کند.",
      ],
    },
    {
      title: "۱۶. مسئولیت فروشندگان",
      paragraphs: [
        "فروشنده مسئول کیفیت، تحویل، محتوا و مشروعیت کالا یا خدماتی است که از طریق درگاه خود عرضه می‌کند. تومانیت صرفاً ارائه‌دهنده زیرساخت پرداخت است و جز در مواردی که به‌موجب قانون مسئولیت مستقیمی متوجه آن باشد، مسئول ماهیت یا عملکرد کالا و خدمات فروشنده نیست. ثبت صحیح اطلاعات سفارش، مبلغ، شناسه سفارش و وضعیت پرداخت بر عهده فروشنده است.",
      ],
    },
    {
      title: "۱۷. موارد ممنوع در استفاده از درگاه",
      paragraphs: [
        "استفاده از درگاه پلتفرم برای فعالیت‌هایی که به‌موجب قوانین جاری غیرقانونی‌اند یا ریسک غیرمتعارفی برای پلتفرم، شبکه پرداخت یا کاربران ایجاد می‌کنند ممنوع است. پلتفرم می‌تواند فهرست فعالیت‌های ممنوع یا محدود را به‌صورت جداگانه منتشر و به‌روزرسانی کند.",
      ],
    },
    {
      title: "۱۸. محدودیت، تعلیق و مسدودی حساب",
      paragraphs: [
        "در صورت نقض مقررات، ارائه اطلاعات نادرست، فعالیت مشکوک، ظن تقلب یا کلاهبرداری، تلاش برای دور زدن محدودیت‌ها، دریافت گزارش امنیتی، استفاده غیرمجاز از خدمات، الزام قانونی یا درخواست مراجع ذی‌صلاح، و نیز وجود خطر امنیتی برای کاربر یا پلتفرم، تومانیت مجاز است حساب یا بخشی از خدمات را موقتاً محدود یا تعلیق کند. در صورت امکان، علت محدودیت به کاربر اعلام خواهد شد.",
      ],
    },
    {
      title: "۱۹. بررسی منشأ وجوه",
      paragraphs: [
        "در تراکنش‌های خاص، پلتفرم می‌تواند مدارک و اطلاعاتی در خصوص منشأ وجوه، هدف تراکنش یا رابطه میان پرداخت‌کننده و دریافت‌کننده مطالبه کند. خودداری از ارائه اطلاعات مورد نیاز می‌تواند به تداوم محدودیت تراکنش یا حساب منجر شود.",
      ],
    },
    {
      title: "۲۰. کارمزدها",
      paragraphs: [
        "کارمزد هر خدمت پیش از انجام عملیات یا در بخش مربوطه به کاربر اعلام می‌شود. پلتفرم می‌تواند میزان کارمزد را با توجه به نوع عملیات، دارایی، شبکه، حجم تراکنش و شرایط عملیاتی تغییر دهد. کارمزد اعمال‌شده در زمان قطعی‌شدن تراکنش، مبنای محاسبه همان عملیات خواهد بود.",
      ],
    },
    {
      title: "۲۱. اختلالات فنی و عوامل خارج از کنترل",
      paragraphs: [
        "پلتفرم تلاش متعارف خود را برای ارائه پایدار خدمات به‌کار می‌گیرد؛ با این حال اختلال در شبکه بلاکچین، تلگرام، بانک یا شبکه پرداخت، حملات سایبری، مشکلات زیرساختی، قطعی اینترنت، خطا یا قصور ارائه‌دهندگان خدمات ثالث، و شرایط اضطراری ممکن است موجب تأخیر یا اختلال در خدمات گردد و پلتفرم در قبال آثار ناشی از این عوامل، جز در حدود مقرر در قانون، مسئولیتی نخواهد داشت.",
      ],
    },
    {
      title: "۲۲. مسئولیت کاربر",
      paragraphs: [
        "کلیه فعالیت‌های انجام‌شده از طریق حساب کاربری، جز در فرضی که دسترسی غیرمجاز بدون تقصیر کاربر به‌نحو معتبر اثبات شود، بر عهده و مسئولیت کاربر است. کاربر مکلف است قوانین و مقررات ناظر بر فعالیت خود را رعایت کند و از خدماتی به‌گونه‌ای استفاده ننماید که موجب نقض حقوق اشخاص ثالث یا مقررات لازم‌الاجرا گردد.",
      ],
    },
    {
      title: "۲۳. حریم خصوصی و حفاظت از داده‌ها",
      paragraphs: [
        "اطلاعات کاربران مطابق سیاست حریم خصوصی پلتفرم جمع‌آوری، پردازش و نگهداری می‌شود و ممکن است برای ارائه خدمات، احراز هویت، تأمین امنیت حساب، پیشگیری از تقلب، بررسی تراکنش‌ها، پشتیبانی و رعایت الزامات قانونی به‌کار رود. در مواردی که قانون یا مرجع ذی‌صلاح الزام کند، اطلاعات مربوطه در اختیار مراجع صالح قرار خواهد گرفت.",
      ],
    },
    {
      title: "۲۴. پذیرش مقررات",
      paragraphs: [
        "با ایجاد حساب، ورود به مینی اپلیکیشن، انجام تراکنش یا استفاده از هر یک از خدمات، کاربر اقرار و تأیید می‌کند که:",
      ],
      bullets: [
        "متن حاضر را مطالعه کرده و شرایط استفاده را پذیرفته است؛",
        "اطلاعات ارائه‌شده از سوی وی صحیح و متعلق به خود اوست؛",
        "مسئولیت حفظ امنیت حساب خود را می‌پذیرد؛",
        "از خدمات برای هیچ فعالیت غیرقانونی یا ممنوع استفاده نخواهد کرد.",
      ],
    },
    {
      title: "۲۵. حق اصلاح مقررات",
      paragraphs: [
        "پلتفرم حق دارد مقررات، سقف تراکنش‌ها، کارمزدها، فرآیند احراز هویت و شرایط ارائه خدمات را اصلاح یا به‌روزرسانی کند. نسخه جدید از زمان اعلام یا انتشار، حسب مورد، جایگزین نسخه پیشین خواهد شد.",
      ],
    },
    {
      title: "۲۶. ارتباط با پشتیبانی",
      paragraphs: [
        "در صورت مشاهده فعالیت مشکوک، برداشت غیرمجاز، فیشینگ، کلاهبرداری یا هرگونه اشکال در تراکنش، کاربر باید موضوع را در اسرع وقت از طریق کانال‌های رسمی پشتیبانی، مندرج در مینی اپلیکیشن و وب‌سایت رسمی پلتفرم، گزارش کند. پشتیبانی رسمی صرفاً از همین مجاری ارائه می‌شود.",
      ],
    },
    {
      title: "اطلاعیه امنیتی",
      danger: true,
      paragraphs: [
        "رمز عبور، کد ورود، کد تأیید، عبارت بازیابی کیف پول یا کلید خصوصی (Private Key) را در اختیار هیچ شخص یا مجموعه‌ای قرار ندهید. پشتیبانی رسمی تومانیت برای انجام عملیات حساب، هرگز به عبارت بازیابی یا کلید خصوصی نیاز ندارد.",
        "پیش از هر انتقال دارایی دیجیتال، نام دارایی، شبکه، نشانی مقصد و مبلغ را با دقت کنترل کنید. تراکنش‌های ثبت‌شده در بلاکچین ممکن است غیرقابل بازگشت باشند. حفظ امنیت حساب و اطلاعات ورود بر عهده کاربر است.",
      ],
    },
  ],
  endNote: "پایان شرایط و مقررات استفاده",
};

const TERMS_EN: TermsDoc = {
  docTitle: "Terms and Conditions for Using the Tomanit Platform",
  lastUpdated: "Last updated: 23 Sep 2026",
  sections: [
    {
      paragraphs: [
        "Accessing the mini application, creating an account, or using any Tomanit service—including bots, web services, and other parts of the system—constitutes full awareness of this document and unconditional acceptance of its terms. You must read this text carefully before using the services.",
        "Tomanit may amend or update these terms and transaction limits to meet legal, security, technical, or operational requirements. Continued use of the services after changes take effect constitutes acceptance of the new version.",
      ],
    },
    {
      title: "1. Definitions",
      paragraphs: ["In these terms, the following words have the meanings set out below:"],
      bullets: [
        {
          strong: "Platform / Tomanit:",
          text:
            "The systems, mini application, bots, web services, and other services offered under the Tomanit name.",
        },
        { strong: "User:", text: "Any natural or legal person who uses the platform's services." },
        {
          strong: "Identity verification (KYC):",
          text: "The process of reviewing and confirming a user's identity according to platform procedures and requirements.",
        },
        {
          strong: "Transaction:",
          text: "Any purchase, sale, transfer, payment, withdrawal, receipt, or conversion of assets through the platform.",
        },
        {
          strong: "Digital asset:",
          text: "Cryptocurrencies and other digital assets listed as supported by the platform at any given time.",
        },
        {
          strong: "Crypto payment gateway:",
          text:
            "Services that enable businesses to issue invoices, receive crypto payments, and use web services.",
        },
      ],
    },
    {
      title: "2. General terms of use",
      bullets: [
        "Services may only be used by persons who are legally permitted to use such services under applicable law.",
        "You are responsible for the accuracy, completeness, and timeliness of all information you provide to the platform.",
        "Creating an account or using services with a third party's identity, forged documents, or false details is prohibited.",
        "Each account must be controlled by the person in whose name the account information is registered.",
        "Selling, renting, assigning, or transferring an account to another person is strictly prohibited.",
        "You must keep login credentials, passwords, verification codes, and other security data confidential.",
        "The platform may temporarily or permanently limit, suspend, or block access to certain services or accounts to protect users or comply with legal requirements.",
      ],
    },
    {
      title: "3. Verification levels and transaction limits",
      paragraphs: [
        "To manage risk, prevent abuse, and meet operational requirements, permitted financial activity limits by verification level are as follows:",
      ],
      table: {
        headers: ["Verification level", "Daily limit", "30-day limit"],
        rows: [
          {
            level: "Base (unverified)",
            amount: "500,000",
            unit: "Toman",
            monthly: "5,000,000",
          },
          {
            level: "Level 1",
            amount: "5,000,000",
            unit: "Toman",
            monthly: "100,000,000",
          },
          {
            level: "Level 2",
            amount: "50,000,000",
            unit: "Toman",
            monthly: "1,000,000,000",
          },
        ],
      },
      paragraphsAfter: [
        "These limits are internal operational thresholds and may be raised or lowered depending on transaction type, asset type, payment method, account status, risk assessment, applicable regulations, or security decisions. After a rial deposit, crypto withdrawals are restricted for 72 hours; crypto deposit and withdraw are not subject to that lock. The platform may request additional verification even within the permitted limit.",
      ],
    },
    {
      title: "4. Identity verification",
      bullets: [
        "Providing or continuing certain services depends on successful completion of identity verification.",
        "Identity information and documents must belong solely to you.",
        "Incomplete, incorrect, or third-party information may halt verification or lead to account restrictions.",
        "The platform may request additional documents or information when necessary.",
        "Completing verification does not guarantee that all transactions will be processed or that security limits will be waived.",
        "Identity data is processed only in line with law, the privacy policy, and platform security requirements.",
      ],
    },
    {
      title: "5. Fiat (rial) payment rules",
      bullets: [
        "Rial payments are permitted only through payment methods and accounts approved by the platform.",
        "Use of a third party's bank card, account, or payment instrument may result in a hold or review of the transaction.",
        "If payer details do not match the account holder, the platform will suspend the transaction until the matter is resolved.",
        "Unauthorized payment methods, suspicious payments, forged details, or attempts to circumvent payment limits are prohibited.",
        "You are responsible for the accuracy of payment information you enter.",
        "If a bank error, payment network outage, or incorrect posting occurs, the final status is determined based on platform records and data from payment service providers.",
      ],
    },
    {
      title: "6. Anti–money laundering and prohibited activity",
      paragraphs: ["Using the platform for any of the following is strictly prohibited:"],
      bullets: [
        "Money laundering and financing of illegal activity",
        "Fraud, theft, phishing, and related crimes",
        "Theft of banking data or trading in card information",
        "Use of proceeds of crime",
        "Circumventing legal or financial restrictions",
        "Using another person's account or multiple accounts to evade limits",
        "Sham or fictitious transactions",
        "Any act contrary to applicable laws and regulations",
      ],
      paragraphsAfter: [
        "The platform may pause transactions that appear technically, financially, or behaviorally unusual or suspicious for further review and may limit certain services until the review is complete.",
      ],
    },
    {
      title: "7. Suspicious transactions",
      paragraphs: [
        "If the platform observes unusual transaction volume, sudden account activity, abnormal multi-account patterns, attempts to exceed limits, links to high-risk sources or destinations, mismatches between identity and financial data, funds received from or sent to multiple persons without clear justification, or other suspicious behavior, it may request additional documents, temporarily restrict the account, halt transactions, review the source of funds, and take other prudent measures.",
      ],
    },
    {
      title: "8. Anti-phishing and fraud policy",
      paragraphs: [
        "Tomanit will never ask you via private messages or unofficial channels for: passwords, login codes, SMS or Telegram verification codes, wallet recovery phrases, private keys, full card details, second passwords or CVV2, or transfers to addresses shared by unknown accounts.",
        "Before any payment or digital asset transfer, you must carefully verify the destination and transaction details. Losses from transfers to persons or addresses outside the platform's official process—including deception, phishing, or user negligence—are not borne by the platform except where applicable law imposes direct liability on the platform.",
      ],
    },
    {
      title: "9. Official channels",
      paragraphs: [
        "You must obtain services and announcements only through officially published channels and addresses. Merely presenting an account, bot, channel, website, or person as a Tomanit representative does not make them official. Before sending funds or disclosing sensitive information, verify the authenticity of the destination.",
      ],
    },
    {
      title: "10. Cryptocurrency transactions",
      bullets: [
        "Transactions broadcast to a blockchain network are often irreversible, depending on network conditions.",
        "Choosing the correct network, destination address, and asset type is your responsibility.",
        "Sending assets on the wrong network may result in permanent loss.",
        "The platform is not liable for transactions sent to the wrong address or network except as required by applicable law.",
        "Confirmation times depend on network conditions, required confirmations, congestion, and other technical factors.",
        "Network fees and related costs may be deducted from the transaction amount or charged separately.",
      ],
    },
    {
      title: "11. Pricing and conversion rates",
      paragraphs: [
        "Buy, sell, and conversion rates are set by the platform and shown to you at the time of the operation. Because markets move, the rate may change between viewing a price and completing the operation. If a rate is locked for a stated period, that rate remains valid until the period ends.",
      ],
    },
    {
      title: "12. Cancellation, refunds, and corrections",
      paragraphs: [
        "After a cryptocurrency transaction is submitted to the network, cancellation may not be possible. Where a transaction has not yet been processed or a refund is possible under internal procedures, your request will be reviewed. Any repayment depends on review of the source of funds, transaction history, and account status; network or operational fees may be deducted from the refunded amount where applicable.",
      ],
    },
    {
      title: "13. Account security",
      paragraphs: ["You must:"],
      bullets: [
        "Not share your login credentials with others;",
        "Use secure devices and environments;",
        "Not access your account through unknown or unofficial links;",
        "Not send login or verification codes to others;",
        "Report any suspicious activity to support immediately.",
      ],
      paragraphsAfter: [
        "If there are signs of unauthorized access, the platform may temporarily restrict account activity to protect your assets.",
      ],
    },
    {
      title: "14. Multiple accounts and limit evasion",
      paragraphs: [
        "Creating or operating multiple accounts to evade transaction limits or verification requirements, splitting transactions, using third-party identities, abusing incentive programs, or concealing the true source or destination of funds is prohibited. The platform may review linked accounts and restrict or block them as needed.",
      ],
    },
    {
      title: "15. Crypto payment gateway for businesses",
      paragraphs: ["Businesses using the platform's web service or payment gateway must:"],
      bullets: [
        "Provide accurate and up-to-date business information;",
        "Use the web service only for permitted activities;",
        "Record invoice data correctly and avoid issuing sham invoices;",
        "Keep the web service key and access credentials confidential;",
        "Not use the gateway for any illegal activity.",
      ],
      paragraphsAfter: [
        "If suspicious activity is detected, the platform may temporarily disable the web service key, account, or related invoices.",
      ],
    },
    {
      title: "16. Merchant responsibility",
      paragraphs: [
        "The merchant is responsible for the quality, delivery, content, and legality of goods or services offered through its gateway. Tomanit provides payment infrastructure only and is not responsible for the nature or performance of merchant goods or services except where the law imposes direct liability. Correct recording of order details, amounts, order IDs, and payment status is the merchant's duty.",
      ],
    },
    {
      title: "17. Prohibited gateway uses",
      paragraphs: [
        "Using the platform gateway for activities that are illegal under applicable law or create unusual risk for the platform, payment network, or users is prohibited. The platform may publish and update a separate list of prohibited or restricted activities.",
      ],
    },
    {
      title: "18. Restriction, suspension, and blocking",
      paragraphs: [
        "If terms are violated, false information is provided, activity is suspicious, fraud is suspected, limits are circumvented, a security report is received, services are misused, law or competent authorities require action, or there is a security risk to the user or platform, Tomanit may temporarily restrict or suspend an account or part of the services. Where possible, the reason for restriction will be communicated to you.",
      ],
    },
    {
      title: "19. Source-of-funds review",
      paragraphs: [
        "For certain transactions, the platform may request documents or information about the source of funds, purpose of the transaction, or relationship between payer and payee. Failure to provide required information may prolong transaction or account restrictions.",
      ],
    },
    {
      title: "20. Fees",
      paragraphs: [
        "Fees for each service are disclosed before the operation or in the relevant section. The platform may change fees based on operation type, asset, network, transaction volume, and operational conditions. The fee applied when a transaction is finalized governs that operation.",
      ],
    },
    {
      title: "21. Technical outages and force majeure",
      paragraphs: [
        "The platform uses reasonable efforts to provide stable services; however, disruptions to blockchain networks, Telegram, banks, or payment networks, cyberattacks, infrastructure failures, internet outages, errors by third-party providers, or emergency conditions may cause delays or outages. The platform is not liable for effects of such factors except as provided by law.",
      ],
    },
    {
      title: "22. User responsibility",
      paragraphs: [
        "Activity conducted through your account is your responsibility unless unauthorized access without your fault is validly proven. You must comply with laws governing your activity and must not use the services in ways that violate third-party rights or applicable regulations.",
      ],
    },
    {
      title: "23. Privacy and data protection",
      paragraphs: [
        "User information is collected, processed, and stored in accordance with the platform privacy policy and may be used to provide services, verify identity, secure accounts, prevent fraud, review transactions, provide support, and meet legal obligations. Where required by law or competent authorities, relevant information may be disclosed to proper authorities.",
      ],
    },
    {
      title: "24. Acceptance of terms",
      paragraphs: [
        "By creating an account, entering the mini application, transacting, or using any service, you confirm that:",
      ],
      bullets: [
        "You have read this text and accept the terms of use;",
        "The information you provide is accurate and belongs to you;",
        "You accept responsibility for keeping your account secure;",
        "You will not use the services for any illegal or prohibited activity.",
      ],
    },
    {
      title: "25. Right to amend terms",
      paragraphs: [
        "The platform may amend or update terms, transaction limits, fees, verification processes, and service conditions. The new version replaces the previous one from the time of announcement or publication, as applicable.",
      ],
    },
    {
      title: "26. Contacting support",
      paragraphs: [
        "If you notice suspicious activity, unauthorized withdrawals, phishing, fraud, or any transaction issue, report it promptly through official support channels listed in the mini application and on the platform's official website. Official support is provided only through these channels.",
      ],
    },
    {
      title: "Security notice",
      danger: true,
      paragraphs: [
        "Never share your password, login code, verification code, wallet recovery phrase, or private key with anyone. Official Tomanit support never needs your recovery phrase or private key to operate your account.",
        "Before every digital asset transfer, carefully check the asset name, network, destination address, and amount. Blockchain transactions may be irreversible. You are responsible for account and login security.",
      ],
    },
  ],
  endNote: "End of terms and conditions of use",
};

const TERMS_AR: TermsDoc = {
  docTitle: "شروط وأحكام استخدام منصة تومانيت",
  lastUpdated: "آخر تحديث: ٢٣ سبتمبر ٢٠٢٦",
  sections: [
    {
      paragraphs: [
        "الدخول إلى التطبيق المصغّر أو إنشاء حساب أو استخدام أي خدمة من خدمات تومانيت، بما في ذلك الروبوتات وخدمات الويب ومكوّنات النظام الأخرى، يعني إلمامك الكامل بهذا المستند وقبولك غير المشروط لأحكامه. يجب عليك قراءة هذا النص بعناية قبل استخدام الخدمات.",
        "يجوز لتومانيت تعديل أو تحديث هذه الشروط وسقوف المعاملات استجابةً للمتطلبات القانونية أو الأمنية أو التقنية أو التشغيلية. يُعدّ استمرار استخدام الخدمات بعد سريان التغييرات قبولاً للنسخة الجديدة.",
      ],
    },
    {
      title: "١. التعريفات",
      paragraphs: ["في هذه الشروط، للمصطلحات التالية المعاني المبينة أدناه:"],
      bullets: [
        {
          strong: "المنصة / تومانيت:",
          text: "مجموعة الأنظمة والتطبيق المصغّر والروبوتات وخدمات الويب والخدمات الأخرى المقدّمة تحت اسم تومانيت.",
        },
        { strong: "المستخدم:", text: "كل شخص طبيعي أو اعتباري يستخدم خدمات المنصة." },
        {
          strong: "التحقق من الهوية:",
          text: "عملية مراجعة وتأكيد هوية المستخدم وفق إجراءات ومتطلبات المنصة.",
        },
        {
          strong: "المعاملة:",
          text: "أي شراء أو بيع أو تحويل أو دفع أو سحب أو استلام أو تحويل أصول عبر المنصة.",
        },
        {
          strong: "الأصول الرقمية:",
          text: "العملات المشفّرة والأصول الرقمية الأخرى المدرجة ضمن قائمة الدعم في المنصة في أي وقت.",
        },
        {
          strong: "بوابة الدفع بالعملات المشفّرة:",
          text: "خدمات تمكّن الشركات من إصدار الفواتير واستلام المدفوعات المشفّرة واستخدام خدمات الويب.",
        },
      ],
    },
    {
      title: "٢. شروط الاستخدام العامة",
      bullets: [
        "يُسمح باستخدام الخدمات فقط للأشخاص المخوّلين قانوناً باستخدام مثل هذه الخدمات وفق القوانين السارية.",
        "أنت مسؤول عن صحة واكتمال وحداثة جميع المعلومات التي تقدّمها للمنصة.",
        "يُحظر إنشاء حساب أو استخدام الخدمات بهوية طرف ثالث أو وثائق مزوّرة أو بيانات غير حقيقية.",
        "يجب أن يكون كل حساب تحت سيطرة الشخص الذي سُجّلت بيانات الحساب باسمه.",
        "يُحظر بيع أو تأجير أو التنازل عن الحساب أو نقله إلى الغير.",
        "يجب عليك الحفاظ على سرية بيانات الدخول وكلمات المرور ورموز التحقق والبيانات الأمنية الأخرى.",
        "يجوز للمنصة تقييد أو تعليق أو حظر الوصول إلى بعض الخدمات أو الحسابات مؤقتاً أو دائماً لحماية المستخدمين أو الامتثال للمتطلبات القانونية.",
      ],
    },
    {
      title: "٣. مستويات التحقق وسقوف المعاملات",
      paragraphs: [
        "لإدارة المخاطر ومنع إساءة الاستخدام والوفاء بالمتطلبات التشغيلية، يُحدَّد إجمالي النشاط المالي المسموح به في كل يوم وفق مستوى التحقق كما في الجدول أدناه:",
      ],
      table: {
        headers: ["مستوى التحقق", "الحد اليومي", "حد ٣٠ يوماً"],
        rows: [
          {
            level: "أساسي (بدون تحقق)",
            amount: "500,000",
            unit: "تومان",
            monthly: "5,000,000",
          },
          {
            level: "المستوى ١",
            amount: "5,000,000",
            unit: "تومان",
            monthly: "100,000,000",
          },
          {
            level: "المستوى ٢",
            amount: "50,000,000",
            unit: "تومان",
            monthly: "1,000,000,000",
          },
        ],
      },
      paragraphsAfter: [
        "هذه السقوف حدود تشغيلية داخلية. بعد الإيداع بالريال يُقيَّد سحب العملات المشفرة لمدة ٧٢ ساعة؛ إيداع وسحب العملات المشفرة غير خاضعين لهذا القفل. قد تطلب المنصة تحققاً إضافياً حتى داخل السقف المسموح.",
      ],
    },
    {
      title: "٤. التحقق من الهوية",
      bullets: [
        "تقديم بعض الخدمات أو استمرارها يتوقف على إتمام التحقق من الهوية بنجاح.",
        "يجب أن تكون معلومات ووثائق الهوية ملكاً لك حصرياً.",
        "المعلومات الناقصة أو الخاطئة أو الخاصة بالغير قد توقف التحقق أو تفرض قيوداً على الحساب.",
        "يجوز للمنصة طلب وثائق أو معلومات إضافية عند الحاجة.",
        "إتمام التحقق لا يعني ضمان تنفيذ جميع المعاملات أو إعفاء من قيود الأمن.",
        "تُعالَج بيانات الهوية فقط وفق القانون وسياسة الخصوصية ومتطلبات أمن المنصة.",
      ],
    },
    {
      title: "٥. قواعد الدفع بالريال",
      bullets: [
        "يُسمح بالدفع بالريال فقط عبر طرق وحسابات معتمدة من المنصة.",
        "استخدام بطاقة أو حساب أو أداة دفع لطرف ثالث قد يؤدي إلى تعليق المعاملة أو مراجعتها.",
        "إذا تعذّر تطابق بيانات الدافع مع صاحب الحساب، تعلّق المنصة المعاملة حتى البت في الأمر.",
        "يُحظر استخدام طرق دفع غير مصرح بها أو مدفوعات مشبوهة أو بيانات مزوّرة أو محاولات التحايل على حدود الدفع.",
        "أنت مسؤول عن صحة معلومات الدفع التي تُدخلها.",
        "في حال خطأ مصرفي أو عطل في شبكة الدفع أو تسجيل غير صحيح، يُحدَّد الوضع النهائي وفق سجلات المنصة وبيانات مزوّدي الدفع.",
      ],
    },
    {
      title: "٦. مكافحة غسل الأموال والأنشطة المحظورة",
      paragraphs: ["يُحظر تماماً استخدام المنصة في أي من الأمور التالية:"],
      bullets: [
        "غسل الأموال وتمويل الأنشطة غير المشروعة",
        "الاحتيال والسرقة والتصيّد والجرائم ذات الصلة",
        "سرقة البيانات المصرفية أو تداول معلومات البطاقات",
        "استخدام أموال ناتجة عن جريمة",
        "التحايل على القيود القانونية أو المالية",
        "استخدام حساب الغير أو حسابات متعددة للتحايل على الحدود",
        "معاملات صورية أو وهمية",
        "أي فعل يخالف القوانين واللوائح السارية",
      ],
      paragraphsAfter: [
        "يجوز للمنصة إيقاف المعاملات التي تبدو غير عادية أو مشبوهة تقنياً أو مالياً أو سلوكياً لمراجعتها وتقييد بعض الخدمات حتى انتهاء المراجعة.",
      ],
    },
    {
      title: "٧. المعاملات المشبوهة",
      paragraphs: [
        "عند ملاحظة حجم غير معتاد للمعاملات أو نشاط مفاجئ للحساب أو نمط حسابات متعددة غير طبيعي أو محاولات تجاوز السقوف أو ارتباط بمصادر أو وجهات عالية المخاطر أو تعارض بين الهوية والبيانات المالية أو تلقي أو إرسال أموال من أشخاص متعددين دون مبرر واضح أو سلوك مشبوه آخر، قد تطلب المنصة وثائق إضافية وتقييد الحساب مؤقتاً وإيقاف المعاملات ومراجعة مصدر الأموال واتخاذ إجراءات احترازية أخرى.",
      ],
    },
    {
      title: "٨. سياسة مكافحة التصيّد والاحتيال",
      paragraphs: [
        "لن يطلب تومانيت منك عبر رسائل خاصة أو قنوات غير رسمية: كلمات المرور أو رموز الدخول أو رموز التحقق عبر الرسائل أو تيليغرام أو عبارة استرداد المحفظة أو المفتاح الخاص أو تفاصيل البطاقة الكاملة أو الرمز الثاني أو CVV2 أو تحويلات إلى عناوين أُعلنت عبر حسابات مجهولة.",
        "قبل أي دفع أو تحويل أصول رقمية، يجب التحقق بعناية من الوجهة وتفاصيل المعاملة. لا تتحمّل المنصة خسائر التحويل إلى أشخاص أو عناوين خارج الإجراء الرسمي للمنصة، بما في ذلك الخداع أو التصيّد أو إهمال المستخدم، إلا حيث يفرض القانون مسؤولية مباشرة على المنصة.",
      ],
    },
    {
      title: "٩. القنوات الرسمية",
      paragraphs: [
        "يجب الحصول على الخدمات والإعلانات فقط عبر القنوات والعناوين الرسمية المنشورة. مجرد تقديم حساب أو روبوت أو قناة أو موقع أو شخص كممثل لتومانيت لا يجعله رسمياً. قبل إرسال الأموال أو الكشف عن معلومات حساسة، يجب التحقق من صحة الوجهة.",
      ],
    },
    {
      title: "١٠. معاملات العملات المشفّرة",
      bullets: [
        "المعاملات المُرسَلة إلى شبكة البلوكشين غالباً غير قابلة للإلغاء بحسب حالة الشبكة.",
        "اختيار الشبكة الصحيحة وعنوان الوجهة ونوع الأصل مسؤوليتك.",
        "الإرسال على شبكة خاطئة قد يؤدي إلى فقدان دائم للأصول.",
        "المنصة غير مسؤولة عن المعاملات المُرسَلة إلى عنوان أو شبكة خاطئة إلا وفق ما يفرضه القانون.",
        "وقت التأكيد يعتمد على الشبكة وعدد التأكيدات المطلوبة والازدحام وعوامل تقنية أخرى.",
        "قد تُخصم رسوم الشبكة والتكاليف ذات الصلة من مبلغ المعاملة أو تُفرض بشكل منفصل.",
      ],
    },
    {
      title: "١١. التسعير وأسعار التحويل",
      paragraphs: [
        "تحدد المنصة أسعار الشراء والبيع والتحويل وتُعرَض لك لحظة تنفيذ العملية. نظراً لتقلبات السوق، قد يتغير السعر بين عرضه وإتمام العملية. إذا اُقفل السعر لفترة محددة، يظل سارياً حتى نهاية تلك الفترة.",
      ],
    },
    {
      title: "١٢. الإلغاء والاسترداد وتصحيح المعاملات",
      paragraphs: [
        "بعد إرسال معاملة مشفّرة إلى الشبكة، قد لا يكون الإلغاء ممكناً. حيث لم تُعالَج المعاملة بعد أو يكون الاسترداد ممكناً وفق الإجراءات الداخلية، تُراجع طلبك. أي سداد يعتمد على مراجعة مصدر الأموال وسجل المعاملات وحالة الحساب وقد تُخصم رسوم الشبكة أو التشغيل من المبلغ المسترد.",
      ],
    },
    {
      title: "١٣. أمن الحساب",
      paragraphs: ["يجب عليك:"],
      bullets: [
        "عدم مشاركة بيانات الدخول مع الآخرين؛",
        "استخدام أجهزة وبيئات آمنة؛",
        "عدم الدخول عبر روابط مجهولة أو غير رسمية؛",
        "عدم إرسال رموز الدخول أو التحقق للآخرين؛",
        "الإبلاغ فوراً عن أي نشاط مشبوه للدعم.",
      ],
      paragraphsAfter: [
        "عند وجود مؤشرات وصول غير مصرح به، يجوز للمنصة تقييد نشاط الحساب مؤقتاً لحماية أصولك.",
      ],
    },
    {
      title: "١٤. حسابات متعددة والتحايل على الحدود",
      paragraphs: [
        "يُحظر إنشاء أو إدارة حسابات متعددة للتحايل على سقوف المعاملات أو متطلبات التحقق أو تقسيم المعاملات أو استخدام هويات الغير أو إساءة استخدام الحوافز أو إخفاء مصدر أو وجهة الأموال الحقيقية. قد تراجع المنصة الحسابات المرتبطة وتقيّدها أو تحظرها.",
      ],
    },
    {
      title: "١٥. بوابة الدفع المشفّرة للشركات",
      paragraphs: ["الشركات التي تستخدم خدمة الويب أو بوابة الدفع في المنصة يجب أن:"],
      bullets: [
        "تقديم معلومات تجارية صحيحة ومحدّثة؛",
        "استخدام خدمة الويب فقط للأنشطة المسموح بها؛",
        "تسجيل بيانات الفواتير بشكل صحيح وعدم إصدار فواتير صورية؛",
        "الحفاظ على سرية مفتاح خدمة الويب وبيانات الوصول؛",
        "عدم استخدام البوابة لأي نشاط غير قانوني.",
      ],
      paragraphsAfter: [
        "عند رصد نشاط مشبوه، قد تعطّل المنصة مفتاح خدمة الويب أو الحساب أو الفواتير ذات الصلة مؤقتاً.",
      ],
    },
    {
      title: "١٦. مسؤولية التاجر",
      paragraphs: [
        "التاجر مسؤول عن جودة وتسليم ومحتوى وقانونية السلع أو الخدمات المعروضة عبر بوابته. تومانيت تقدّم بنية الدفع فقط وليست مسؤولة عن طبيعة أو أداء سلع وخدمات التاجر إلا حيث يفرض القانون مسؤولية مباشرة. تسجيل تفاصيل الطلب والمبالغ ومعرّفات الطلب وحالة الدفع بشكل صحيح هو واجب التاجر.",
      ],
    },
    {
      title: "١٧. استخدامات محظورة للبوابة",
      paragraphs: [
        "يُحظر استخدام بوابة المنصة لأنشطة غير قانونية وفق القوانين السارية أو التي تخلق مخاطر غير عادية للمنصة أو شبكة الدفع أو المستخدمين. قد تنشر المنصة قائمة منفصلة للأنشطة المحظورة أو المقيّدة وتحدّثها.",
      ],
    },
    {
      title: "١٨. التقييد والتعليق والحظر",
      paragraphs: [
        "في حال انتهاك الشروط أو تقديم معلومات خاطئة أو نشاط مشبوه أو شك في احتيال أو محاولات التحايل أو بلاغ أمني أو إساءة استخدام الخدمات أو التزام قانوني أو طلب من جهة مختصة أو خطر أمني على المستخدم أو المنصة، يجوز لتومانيت تقييد أو تعليق الحساب أو جزء من الخدمات مؤقتاً. حيثما أمكن، يُبلَغ المستخدم بسبب التقييد.",
      ],
    },
    {
      title: "١٩. مراجعة مصدر الأموال",
      paragraphs: [
        "في معاملات محددة، قد تطلب المنصة وثائقاً أو معلومات عن مصدر الأموال أو غرض المعاملة أو العلاقة بين الدافع والمستلم. قد يؤدي عدم تقديم المعلومات المطلوبة إلى استمرار تقييد المعاملات أو الحساب.",
      ],
    },
    {
      title: "٢٠. الرسوم",
      paragraphs: [
        "تُعرَض رسوم كل خدمة قبل تنفيذ العملية أو في القسم المعني. قد تغيّر المنصة الرسوم بحسب نوع العملية والأصل والشبكة وحجم المعاملة والظروف التشغيلية. الرسوم المطبّقة عند إتمام المعاملة هي أساس حساب تلك العملية.",
      ],
    },
    {
      title: "٢١. الأعطال التقنية والقوة القاهرة",
      paragraphs: [
        "تبذل المنصة جهداً معقولاً لتقديم خدمات مستقرة؛ ومع ذلك قد تسبب اضطرابات شبكات البلوكشين أو تيليغرام أو البنوك أو شبكات الدفع أو هجمات إلكترونية أو أعطال بنية تحتية أو انقطاع الإنترنت أو أخطاء مزوّدين خارجيين أو ظروف طارئة تأخيراً أو انقطاعاً. لا تتحمّل المنصة آثار هذه العوامل إلا في حدود ما ينص عليه القانون.",
      ],
    },
    {
      title: "٢٢. مسؤولية المستخدم",
      paragraphs: [
        "النشاط المنفَّذ عبر حسابك على مسؤوليتك ما لم يُثبت وصول غير مصرح به دون تقصير منك. يجب الامتثال للقوانين المنظّمة لنشاطك وعدم استخدام الخدمات بما ينتهك حقوق الغير أو اللوائح السارية.",
      ],
    },
    {
      title: "٢٣. الخصوصية وحماية البيانات",
      paragraphs: [
        "تُجمع معلومات المستخدم وتُعالَج وتُخزَّن وفق سياسة الخصوصية وقد تُستخدم لتقديم الخدمات والتحقق من الهوية وتأمين الحسابات ومنع الاحتيال ومراجعة المعاملات والدعم والوفاء بالالتزامات القانونية. حيث يفرض القانون أو الجهة المختصة، قد تُسلَّم المعلومات للجهات المختصة.",
      ],
    },
    {
      title: "٢٤. قبول الشروط",
      paragraphs: ["بإنشاء حساب أو الدخول إلى التطبيق المصغّر أو إجراء معاملة أو استخدام أي خدمة، تؤكد أن:"],
      bullets: [
        "قرأت هذا النص وقبلت شروط الاستخدام؛",
        "المعلومات التي تقدّمها صحيحة وملكك؛",
        "تقبل مسؤولية الحفاظ على أمن حسابك؛",
        "لن تستخدم الخدمات لأي نشاط غير قانوني أو محظور.",
      ],
    },
    {
      title: "٢٥. حق تعديل الشروط",
      paragraphs: [
        "يجوز للمنصة تعديل أو تحديث الشروط وسقوف المعاملات والرسوم وإجراءات التحقق وشروط الخدمة. تحل النسخة الجديدة محل السابقة من وقت الإعلان أو النشر حسب الحالة.",
      ],
    },
    {
      title: "٢٦. التواصل مع الدعم",
      paragraphs: [
        "عند ملاحظة نشاط مشبوه أو سحب غير مصرح به أو تصيّد أو احتيال أو أي مشكلة في المعاملة، يجب الإبلاغ فوراً عبر قنوات الدعم الرسمية المدرجة في التطبيق المصغّر والموقع الرسمي. يُقدَّم الدعم الرسمي فقط عبر هذه القنوات.",
      ],
    },
    {
      title: "إشعار أمني",
      danger: true,
      paragraphs: [
        "لا تشارك أبداً كلمة المرور أو رمز الدخول أو رمز التحقق أو عبارة استرداد المحفظة أو المفتاح الخاص مع أي شخص. دعم تومانيت الرسمي لا يحتاج أبداً إلى عبارة الاسترداد أو المفتاح الخاص لتشغيل حسابك.",
        "قبل كل تحويل أصول رقمية، تحقق بعناية من اسم الأصل والشبكة وعنوان الوجهة والمبلغ. قد تكون معاملات البلوكشين غير قابلة للإلغاء. أنت مسؤول عن أمن الحساب وبيانات الدخول.",
      ],
    },
  ],
  endNote: "نهاية شروط وأحكام الاستخدام",
};

const TERMS_ZH: TermsDoc = {
  docTitle: "Tomanit 平台使用条款与条件",
  lastUpdated: "最后更新：2026年9月23日",
  sections: [
    {
      paragraphs: [
        "进入小程序、创建账户或使用 Tomanit 的任何服务（包括机器人、Web 服务及系统其他组件），即表示您已充分了解本文件内容并无条件接受其条款。使用服务前，请务必仔细阅读本文本。",
        "Tomanit 可因法律、安全、技术或运营要求修订或更新本条款及交易限额。变更生效后继续使用服务，即视为接受新版本。",
      ],
    },
    {
      title: "1. 定义",
      paragraphs: ["本条款中下列术语具有如下含义："],
      bullets: [
        { strong: "平台 / Tomanit：", text: "以 Tomanit 名义提供的系统、小程序、机器人、Web 服务及其他服务。" },
        { strong: "用户：", text: "使用平台服务的任何自然人或法人。" },
        { strong: "身份验证（KYC）：", text: "根据平台程序与要求审核并确认用户身份的过程。" },
        { strong: "交易：", text: "通过平台进行任何购买、出售、转账、支付、提现、收款或资产兑换。" },
        { strong: "数字资产：", text: "在任一时点列入平台支持列表的加密货币及其他数字资产。" },
        { strong: "加密货币支付网关：", text: "为商户提供开具发票、接收加密货币付款及使用 Web 服务的功能。" },
      ],
    },
    {
      title: "2. 一般使用条件",
      bullets: [
        "仅依法有权使用此类服务的个人方可使用本平台服务。",
        "您须对向平台提供的全部信息的准确性、完整性和时效性负责。",
        "禁止使用他人身份信息、伪造证件或虚假资料注册或使用服务。",
        "每个账户须由登记在其名下的本人控制并承担责任。",
        "严禁出售、出租、转让或以其他方式向他人转移账户。",
        "您须对登录信息、密码、验证码及其他安全数据保密。",
        "为保护用户或履行法律义务，平台可临时或永久限制、暂停或封禁部分服务或账户。",
      ],
    },
    {
      title: "3. 验证等级与交易限额",
      paragraphs: [
        "为管理风险、防止滥用并满足运营要求，每日允许的金融活动总额按您的验证等级确定，如下表所示：",
      ],
      table: {
        headers: ["验证等级", "每日限额", "30日限额"],
        rows: [
          {
            level: "基础（未验证）",
            amount: "500,000",
            unit: "Toman",
            monthly: "5,000,000",
          },
          {
            level: "等级 1",
            amount: "5,000,000",
            unit: "Toman",
            monthly: "100,000,000",
          },
          {
            level: "等级 2",
            amount: "50,000,000",
            unit: "Toman",
            monthly: "1,000,000,000",
          },
        ],
      },
      paragraphsAfter: [
        "上述限额为平台内部运营阈值。里亚尔充值后，加密货币提现限制72小时；加密充值与提现不受此锁定。即使在限额内，平台仍可要求补充验证。",
      ],
    },
    {
      title: "4. 身份验证",
      bullets: [
        "提供或继续使用部分服务须成功完成身份验证。",
        "身份信息与证件必须仅属于您本人。",
        "信息不完整、不正确或非本人信息可能导致验证中止或账户受限。",
        "必要时平台可要求补充材料或信息。",
        "完成验证并不保证所有交易均可执行，也不免除安全限制。",
        "身份数据仅在法律、隐私政策及平台安全要求范围内处理。",
      ],
    },
    {
      title: "5. 里亚尔（本币）支付规则",
      bullets: [
        "里亚尔支付仅可通过平台认可的方式和账户进行。",
        "使用第三方银行卡、账户或支付工具可能导致交易暂停或审查。",
        "若付款人信息与账户持有人不一致，平台将暂停交易直至处理完毕。",
        "禁止使用未授权支付方式、可疑支付、伪造信息或试图规避支付限制。",
        "您对输入的支付信息准确性负责。",
        "若发生银行错误、支付网络故障或入账异常，最终状态以平台记录及支付服务商数据为准。",
      ],
    },
    {
      title: "6. 反洗钱与禁止行为",
      paragraphs: ["严禁将平台用于以下任何目的："],
      bullets: [
        "洗钱及为非法活动提供资金",
        "欺诈、盗窃、钓鱼及相关犯罪",
        "窃取银行信息或买卖银行卡信息",
        "使用犯罪所得",
        "规避法律或金融限制",
        "使用他人账户或开设多个账户以规避限额",
        "虚假或伪造交易",
        "任何违反现行法律法规的行为",
      ],
      paragraphsAfter: [
        "平台可暂停在技术、财务或行为上异常或可疑的交易以进一步审查，并在审查期间限制部分服务。",
      ],
    },
    {
      title: "7. 可疑交易",
      paragraphs: [
        "若发现交易量异常、账户活动骤增、异常多账户模式、试图突破限额、与高风险来源或目的地关联、身份与财务信息不符、无明确理由从多人收付款或其他可疑行为，平台可要求补充材料、临时限制账户、暂停交易、审查资金来源并采取其他审慎措施。",
      ],
    },
    {
      title: "8. 反钓鱼与反欺诈政策",
      paragraphs: [
        "Tomanit 绝不会通过私信或非官方渠道向您索要：密码、登录码、短信或 Telegram 验证码、钱包助记词、私钥、完整银行卡信息、二次密码或 CVV2，或要求向匿名账户提供的地址转账。",
        "在进行任何支付或数字资产转账前，您须仔细核实目的地和交易信息。因向平台正式流程以外的人员或地址转账（包括欺骗、钓鱼或用户疏忽）造成的损失，除法律明确规定平台须直接承担责任的情形外，由用户自行承担。",
      ],
    },
    {
      title: "9. 官方渠道",
      paragraphs: [
        "您仅应通过公布的官方渠道和地址获取服务及通知。仅将某账户、机器人、频道、网站或人员称为 Tomanit 代表并不构成官方身份。汇款或披露敏感信息前须核实目的地真实性。",
      ],
    },
    {
      title: "10. 加密货币交易",
      bullets: [
        "提交至区块链网络的交易通常不可撤销，具体取决于网络状态。",
        "正确选择网络、目标地址和资产类型是您的责任。",
        "在错误网络上发送资产可能导致永久损失。",
        "除法律要求外，平台不对发送至错误地址或网络的交易负责。",
        "确认时间取决于网络状况、所需确认数、拥堵及其他技术因素。",
        "网络费及相关成本可能从交易金额中扣除或单独收取。",
      ],
    },
    {
      title: "11. 价格与兑换汇率",
      paragraphs: [
        "买卖及兑换汇率由平台确定，并在操作进行时向您展示。鉴于市场波动，从查看价格到完成操作之间汇率可能变化。若汇率在特定时段内锁定，则在该时段结束前有效。",
      ],
    },
    {
      title: "12. 取消、退款与更正",
      paragraphs: [
        "加密货币交易提交至网络后，可能无法取消。若交易尚未处理或根据内部流程可退款，将审查您的申请。任何退款须审查资金来源、交易记录及账户状态；适用的网络或运营费用可能从退款金额中扣除。",
      ],
    },
    {
      title: "13. 账户安全",
      paragraphs: ["您必须："],
      bullets: [
        "不向他人提供登录信息；",
        "使用安全的设备和环境；",
        "不通过未知或非官方链接登录；",
        "不向他人发送登录或验证码；",
        "发现可疑活动立即向客服报告。",
      ],
      paragraphsAfter: [
        "若存在未经授权访问的迹象，平台可临时限制账户操作以保护您的资产。",
      ],
    },
    {
      title: "14. 多账户与规避限额",
      paragraphs: [
        "禁止为规避交易限额或验证要求而创建或运营多个账户、拆分交易、使用第三方身份、滥用激励计划或隐瞒资金真实来源或去向。平台可审查关联账户并视情况限制或封禁。",
      ],
    },
    {
      title: "15. 商户加密货币支付网关",
      paragraphs: ["使用平台 Web 服务或支付网关的商户必须："],
      bullets: [
        "提供准确、最新的商户信息；",
        "仅在允许范围内使用 Web 服务；",
        "正确登记发票信息，不得开具虚假发票；",
        "对 Web 服务密钥及访问凭证保密；",
        "不得将网关用于任何非法活动。",
      ],
      paragraphsAfter: [
        "若发现可疑活动，平台可临时禁用 Web 服务密钥、账户或相关发票。",
      ],
    },
    {
      title: "16. 商户责任",
      paragraphs: [
        "商户对其通过网关提供的商品或服务的质量、交付、内容及合法性负责。Tomanit 仅提供支付基础设施，除法律直接规定外，不对商户商品或服务的性质或表现负责。正确记录订单信息、金额、订单号及支付状态为商户义务。",
      ],
    },
    {
      title: "17. 网关禁止用途",
      paragraphs: [
        "禁止将平台网关用于现行法律下的非法活动，或对平台、支付网络或用户造成异常风险的活动。平台可单独发布并更新禁止或限制活动清单。",
      ],
    },
    {
      title: "18. 限制、暂停与封禁",
      paragraphs: [
        "若违反条款、提供虚假信息、存在可疑活动、涉嫌欺诈、试图规避限制、收到安全报告、滥用服务、法律或主管机关要求，或对用户或平台存在安全风险，Tomanit 可临时限制或暂停账户或部分服务。在可能情况下，将向用户说明限制原因。",
      ],
    },
    {
      title: "19. 资金来源审查",
      paragraphs: [
        "对特定交易，平台可要求提供资金来源、交易目的或付款人与收款人关系的材料或信息。拒绝提供所需信息可能导致交易或账户限制持续。",
      ],
    },
    {
      title: "20. 费用",
      paragraphs: [
        "各项服务费用在操作前或相关栏目中告知。平台可根据操作类型、资产、网络、交易量及运营条件调整费用。交易完成时适用的费用为该笔操作的计算依据。",
      ],
    },
    {
      title: "21. 技术故障与不可抗力",
      paragraphs: [
        "平台尽合理努力提供稳定服务；但区块链网络、Telegram、银行或支付网络中断、网络攻击、基础设施故障、互联网中断、第三方服务商错误或紧急情况可能导致延迟或中断。除法律规定外，平台不对上述因素造成的影响承担责任。",
      ],
    },
    {
      title: "22. 用户责任",
      paragraphs: [
        "通过您账户进行的活动由您负责，除非能有效证明未经授权访问且非因您过错。您须遵守管辖您活动的法律法规，不得以侵犯第三方权利或违反适用规定的方式使用服务。",
      ],
    },
    {
      title: "23. 隐私与数据保护",
      paragraphs: [
        "用户信息依平台隐私政策收集、处理及存储，可用于提供服务、身份验证、账户安全、防欺诈、交易审查、客服及履行法律义务。在法律或主管机关要求时，相关信息可提供给有权机关。",
      ],
    },
    {
      title: "24. 接受条款",
      paragraphs: ["创建账户、进入小程序、进行交易或使用任何服务，即表示您确认："],
      bullets: [
        "已阅读本文本并接受使用条件；",
        "所提供信息真实且属于您本人；",
        "接受维护账户安全的责任；",
        "不会将服务用于任何非法或禁止的活动。",
      ],
    },
    {
      title: "25. 修订条款的权利",
      paragraphs: [
        "平台可修订或更新条款、交易限额、费用、验证流程及服务条件。新版本自公布或发布之时起（视情况而定）取代旧版本。",
      ],
    },
    {
      title: "26. 联系客服",
      paragraphs: [
        "若发现可疑活动、未经授权的提现、钓鱼、欺诈或任何交易问题，请尽快通过小程序及平台官网列出的官方客服渠道报告。官方客服仅通过这些渠道提供。",
      ],
    },
    {
      title: "安全提示",
      danger: true,
      paragraphs: [
        "切勿向任何人透露密码、登录码、验证码、钱包助记词或私钥。Tomanit 官方客服办理账户业务时绝不需要您的助记词或私钥。",
        "每次数字资产转账前，请仔细核对资产名称、网络、目标地址和金额。区块链交易可能不可撤销。账户及登录安全由您自行负责。",
      ],
    },
  ],
  endNote: "使用条款与条件结束",
};

const TERMS_RU: TermsDoc = {
  docTitle: "Условия использования платформы Tomanit",
  lastUpdated: "Последнее обновление: 23 сентября 2026 г.",
  sections: [
    {
      paragraphs: [
        "Вход в мини-приложение, создание учётной записи или использование любых услуг Tomanit, включая ботов, веб-сервисы и другие компоненты системы, означает полное ознакомление с настоящим документом и безоговорочное принятие его условий. Перед использованием услуг внимательно прочитайте этот текст.",
        "Tomanit вправе изменять или обновлять настоящие условия и лимиты операций в связи с правовыми, безопасностными, техническими или операционными требованиями. Продолжение использования услуг после вступления изменений в силу означает принятие новой версии.",
      ],
    },
    {
      title: "1. Определения",
      paragraphs: ["В настоящих условиях следующие термины имеют указанные значения:"],
      bullets: [
        {
          strong: "Платформа / Tomanit:",
          text: "Совокупность систем, мини-приложения, ботов, веб-сервисов и иных услуг, предоставляемых под брендом Tomanit.",
        },
        { strong: "Пользователь:", text: "Любое физическое или юридическое лицо, использующее услуги платформы." },
        {
          strong: "Верификация личности (KYC):",
          text: "Процесс проверки и подтверждения личности пользователя в соответствии с процедурами и требованиями платформы.",
        },
        {
          strong: "Транзакция:",
          text: "Любая покупка, продажа, перевод, оплата, вывод, получение или конвертация активов через платформу.",
        },
        {
          strong: "Цифровой актив:",
          text: "Криптовалюты и иные цифровые активы, включённые в список поддерживаемых платформой в данный момент.",
        },
        {
          strong: "Криптовалютный платёжный шлюз:",
          text: "Услуги, позволяющие бизнесу выставлять счета, принимать криптоплатежи и использовать веб-сервисы.",
        },
      ],
    },
    {
      title: "2. Общие условия использования",
      bullets: [
        "Услугами могут пользоваться только лица, которым это разрешено применимым законодательством.",
        "Вы несёте ответственность за точность, полноту и актуальность всей информации, предоставляемой платформе.",
        "Запрещено создавать учётную запись или пользоваться услугами с данными третьих лиц, поддельными документами или ложными сведениями.",
        "Каждая учётная запись должна находиться под контролем лица, на которое она зарегистрирована.",
        "Продажа, аренда, уступка или передача учётной записи другому лицу строго запрещены.",
        "Вы обязаны сохранять конфиденциальность данных входа, паролей, кодов подтверждения и иной защитной информации.",
        "Платформа вправе временно или постоянно ограничить, приостановить или заблокировать доступ к отдельным услугам или учётным записям для защиты пользователей или соблюдения закона.",
      ],
    },
    {
      title: "3. Уровни верификации и лимиты транзакций",
      paragraphs: [
        "Для управления рисками, предотвращения злоупотреблений и выполнения операционных требований суммарный допустимый финансовый объём операций в сутки устанавливается в зависимости от уровня верификации, как указано ниже:",
      ],
      table: {
        headers: ["Уровень верификации", "Дневной лимит", "Лимит 30 дней"],
        rows: [
          {
            level: "Базовый (без KYC)",
            amount: "500,000",
            unit: "Toman",
            monthly: "5,000,000",
          },
          {
            level: "Уровень 1",
            amount: "5,000,000",
            unit: "Toman",
            monthly: "100,000,000",
          },
          {
            level: "Уровень 2",
            amount: "50,000,000",
            unit: "Toman",
            monthly: "1,000,000,000",
          },
        ],
      },
      paragraphsAfter: [
        "Указанные лимиты — внутренние операционные пороги. После депозита в риалах вывод криптовалюты ограничен на 72 часа; крипто-депозит и вывод под этот блок не попадают. Платформа может запросить доп. верификацию даже в пределах лимита.",
      ],
    },
    {
      title: "4. Верификация личности",
      bullets: [
        "Предоставление или продолжение отдельных услуг зависит от успешного прохождения верификации.",
        "Идентификационные данные и документы должны принадлежать исключительно вам.",
        "Неполные, неверные или чужие данные могут приостановить верификацию или привести к ограничениям счёта.",
        "При необходимости платформа может запросить дополнительные документы или сведения.",
        "Прохождение верификации не гарантирует исполнение всех транзакций и не снимает ограничений безопасности.",
        "Идентификационные данные обрабатываются только в рамках закона, политики конфиденциальности и требований безопасности платформы.",
      ],
    },
    {
      title: "5. Правила оплаты в риалах",
      bullets: [
        "Платежи в риалах разрешены только способами и со счетов, одобренных платформой.",
        "Использование банковской карты, счёта или платёжного инструмента третьего лица может привести к приостановке или проверке транзакции.",
        "При несоответствии данных плательщика и владельца счёта платформа приостанавливает транзакцию до выяснения.",
        "Запрещены несанкционированные способы оплаты, подозрительные платежи, поддельные данные и попытки обойти лимиты.",
        "Вы несёте ответственность за точность вводимых платёжных данных.",
        "При банковской ошибке, сбое платёжной сети или некорректном зачислении итоговый статус определяется по записям платформы и данным платёжных провайдеров.",
      ],
    },
    {
      title: "6. Противодействие отмыванию денег и запрещённая деятельность",
      paragraphs: ["Строго запрещено использовать платформу для следующего:"],
      bullets: [
        "Отмывание денег и финансирование незаконной деятельности",
        "Мошенничество, кража, фишинг и связанные преступления",
        "Кража банковских данных или торговля данными карт",
        "Использование средств, полученных преступным путём",
        "Обход правовых или финансовых ограничений",
        "Использование чужого счёта или нескольких счетов для обхода лимитов",
        "Фиктивные или мнимые транзакции",
        "Любые действия, противоречащие применимым законам",
      ],
      paragraphsAfter: [
        "Платформа может приостановить транзакции, которые выглядят технически, финансово или поведенчески необычными или подозрительными, для дополнительной проверки и ограничить часть услуг до её завершения.",
      ],
    },
    {
      title: "7. Подозрительные транзакции",
      paragraphs: [
        "При нетипичном объёме операций, резком росте активности, аномальных схемах с несколькими счетами, попытках превысить лимиты, связях с высокорисковыми источниками или получателями, расхождении идентификационных и финансовых данных, получении или отправке средств от множества лиц без обоснования или ином подозрительном поведении платформа может запросить дополнительные документы, временно ограничить счёт, остановить транзакции, проверить происхождение средств и принять иные меры предосторожности.",
      ],
    },
    {
      title: "8. Политика против фишинга и мошенничества",
      paragraphs: [
        "Tomanit никогда не запрашивает в личных сообщениях или неофициальных каналах: пароли, коды входа, SMS- или Telegram-коды, seed-фразу кошелька, приватный ключ, полные данные карты, второй пароль или CVV2, а также переводы на адреса, сообщённые анонимными аккаунтами.",
        "Перед любым платежом или переводом цифровых активов тщательно проверяйте получателя и детали операции. Убытки от переводов лицам или на адреса вне официального процесса платформы, включая обман, фишинг или небрежность пользователя, не возмещаются платформой, за исключением случаев прямой ответственности по закону.",
      ],
    },
    {
      title: "9. Официальные каналы",
      paragraphs: [
        "Получайте услуги и уведомления только через официально опубликованные каналы и адреса. Утверждение, что аккаунт, бот, канал, сайт или лицо представляет Tomanit, само по себе не делает их официальными. Перед отправкой средств или раскрытием конфиденциальных данных проверяйте подлинность получателя.",
      ],
    },
    {
      title: "10. Криптовалютные транзакции",
      bullets: [
        "Транзакции, отправленные в сеть блокчейна, как правило, необратимы в зависимости от состояния сети.",
        "Выбор правильной сети, адреса и типа актива — ваша ответственность.",
        "Отправка активов в неверной сети может привести к безвозвратной потере.",
        "Платформа не несёт ответственности за переводы на неверный адрес или сеть, кроме случаев, предусмотренных законом.",
        "Время подтверждения зависит от сети, числа подтверждений, загрузки и иных технических факторов.",
        "Комиссия сети и связанные расходы могут удерживаться из суммы или взиматься отдельно.",
      ],
    },
    {
      title: "11. Цены и курсы конвертации",
      paragraphs: [
        "Курсы покупки, продажи и конвертации устанавливаются платформой и показываются в момент операции. Из-за волатильности рынка курс может измениться между просмотром и завершением операции. Если курс зафиксирован на определённый период, он действует до конца этого периода.",
      ],
    },
    {
      title: "12. Отмена, возврат и исправление",
      paragraphs: [
        "После отправки криптотранзакции в сеть отмена может быть невозможна. Если транзакция ещё не обработана или возврат возможен по внутренним процедурам, запрос будет рассмотрен. Любой возврат зависит от проверки происхождения средств, истории операций и статуса счёта; сетевые или операционные комиссии могут быть удержаны из суммы возврата.",
      ],
    },
    {
      title: "13. Безопасность учётной записи",
      paragraphs: ["Вы обязаны:"],
      bullets: [
        "Не передавать данные входа другим лицам;",
        "Использовать безопасные устройства и среды;",
        "Не входить по неизвестным или неофициальным ссылкам;",
        "Не отправлять коды входа и подтверждения другим;",
        "Немедленно сообщать в поддержку о подозрительной активности.",
      ],
      paragraphsAfter: [
        "При признаках несанкционированного доступа платформа может временно ограничить операции по счёту для защиты ваших активов.",
      ],
    },
    {
      title: "14. Несколько учётных записей и обход лимитов",
      paragraphs: [
        "Запрещено создавать или вести несколько учётных записей для обхода лимитов или требований верификации, дробить транзакции, использовать личности третьих лиц, злоупотреблять программами поощрения или скрывать реальный источник или назначение средств. Платформа может проверить связанные счета и ограничить или заблокировать их.",
      ],
    },
    {
      title: "15. Криптошлюз для бизнеса",
      paragraphs: [
        "Компании, использующие веб-сервис или платёжный шлюз платформы, обязаны:",
      ],
      bullets: [
        "Предоставлять точную и актуальную информацию о бизнесе;",
        "Использовать веб-сервис только в рамках разрешённой деятельности;",
        "Корректно регистрировать данные счетов и не выставлять фиктивные счета;",
        "Сохранять конфиденциальность ключа веб-сервиса и данных доступа;",
        "Не использовать шлюз для незаконной деятельности.",
      ],
      paragraphsAfter: [
        "При обнаружении подозрительной активности платформа может временно отключить ключ веб-сервиса, счёт или связанные счета.",
      ],
    },
    {
      title: "16. Ответственность продавца",
      paragraphs: [
        "Продавец отвечает за качество, доставку, содержание и законность товаров или услуг, предлагаемых через свой шлюз. Tomanit предоставляет только платёжную инфраструктуру и не отвечает за характер или работу товаров и услуг продавца, кроме случаев прямой ответственности по закону. Корректная регистрация данных заказа, сумм, идентификаторов и статуса оплаты — обязанность продавца.",
      ],
    },
    {
      title: "17. Запрещённое использование шлюза",
      paragraphs: [
        "Запрещено использовать шлюз платформы для деятельности, незаконной по применимому праву или создающей нетипичный риск для платформы, платёжной сети или пользователей. Платформа может публиковать и обновлять отдельный перечень запрещённой или ограниченной деятельности.",
      ],
    },
    {
      title: "18. Ограничение, приостановка и блокировка",
      paragraphs: [
        "При нарушении условий, предоставлении ложных данных, подозрительной активности, подозрении в мошенничестве, попытках обхода ограничений, сообщениях о безопасности, неправомерном использовании услуг, требованиях закона или компетентных органов, а также при угрозе безопасности пользователя или платформы Tomanit вправе временно ограничить или приостановить учётную запись или часть услуг. По возможности причина ограничения будет сообщена пользователю.",
      ],
    },
    {
      title: "19. Проверка происхождения средств",
      paragraphs: [
        "По отдельным транзакциям платформа может запросить документы или сведения о происхождении средств, цели операции или связи между плательщиком и получателем. Отказ предоставить необходимую информацию может продлить ограничения на транзакции или счёт.",
      ],
    },
    {
      title: "20. Комиссии",
      paragraphs: [
        "Комиссии за услуги сообщаются до операции или в соответствующем разделе. Платформа может изменять комиссии в зависимости от типа операции, актива, сети, объёма и операционных условий. Комиссия, применённая при завершении транзакции, является основой расчёта для этой операции.",
      ],
    },
    {
      title: "21. Технические сбои и форс-мажор",
      paragraphs: [
        "Платформа прилагает разумные усилия для стабильной работы; однако сбои сетей блокчейна, Telegram, банков или платёжных систем, кибератаки, инфраструктурные проблемы, отключения интернета, ошибки сторонних провайдеров или чрезвычайные обстоятельства могут вызвать задержки или перебои. Платформа не отвечает за последствия таких факторов, кроме предусмотренного законом.",
      ],
    },
    {
      title: "22. Ответственность пользователя",
      paragraphs: [
        "Действия, совершённые через вашу учётную запись, — ваша ответственность, если не доказан несанкционированный доступ не по вашей вине. Вы обязаны соблюдать законы, регулирующие вашу деятельность, и не использовать услуги с нарушением прав третьих лиц или применимых норм.",
      ],
    },
    {
      title: "23. Конфиденциальность и защита данных",
      paragraphs: [
        "Информация пользователей собирается, обрабатывается и хранится в соответствии с политикой конфиденциальности и может использоваться для предоставления услуг, верификации, безопасности счёта, предотвращения мошенничества, проверки транзакций, поддержки и соблюдения закона. По требованию закона или компетентных органов сведения могут быть переданы уполномоченным органам.",
      ],
    },
    {
      title: "24. Принятие условий",
      paragraphs: [
        "Создавая учётную запись, входя в мини-приложение, совершая транзакции или используя любую услугу, вы подтверждаете, что:",
      ],
      bullets: [
        "Прочитали этот текст и принимаете условия использования;",
        "Предоставленная информация верна и принадлежит вам;",
        "Принимаете ответственность за безопасность учётной записи;",
        "Не будете использовать услуги для незаконной или запрещённой деятельности.",
      ],
    },
    {
      title: "25. Право изменять условия",
      paragraphs: [
        "Платформа вправе изменять или обновлять условия, лимиты, комиссии, процедуры верификации и условия предоставления услуг. Новая версия заменяет предыдущую с момента объявления или публикации, в зависимости от случая.",
      ],
    },
    {
      title: "26. Обращение в поддержку",
      paragraphs: [
        "При подозрительной активности, несанкционированном выводе, фишинге, мошенничестве или любой проблеме с транзакцией незамедлительно сообщите через официальные каналы поддержки, указанные в мини-приложении и на официальном сайте. Официальная поддержка предоставляется только через эти каналы.",
      ],
    },
    {
      title: "Предупреждение о безопасности",
      danger: true,
      paragraphs: [
        "Никогда не сообщайте пароль, код входа, код подтверждения, seed-фразу кошелька или приватный ключ никому. Официальная поддержка Tomanit никогда не запрашивает seed-фразу или приватный ключ для работы с вашим счётом.",
        "Перед каждым переводом цифровых активов внимательно проверьте название актива, сеть, адрес получателя и сумму. Транзакции в блокчейне могут быть необратимы. Безопасность учётной записи и данных входа — ваша ответственность.",
      ],
    },
  ],
  endNote: "Конец условий использования",
};

const TERMS_DE: TermsDoc = {
  docTitle: "Nutzungsbedingungen der Tomanit-Plattform",
  lastUpdated: "Zuletzt aktualisiert: 23. September 2026",
  sections: [
    {
      paragraphs: [
        "Der Zugang zur Mini-App, die Erstellung eines Kontos oder die Nutzung eines Tomanit-Dienstes – einschließlich Bots, Webdiensten und anderer Systembestandteile – bedeutet, dass Sie dieses Dokument vollständig zur Kenntnis genommen haben und dessen Bedingungen vorbehaltlos akzeptieren. Lesen Sie diesen Text sorgfältig, bevor Sie die Dienste nutzen.",
        "Tomanit kann diese Bedingungen und Transaktionslimits aus rechtlichen, sicherheits-, technischen oder betrieblichen Gründen ändern oder aktualisieren. Die fortgesetzte Nutzung nach Inkrafttreten von Änderungen gilt als Annahme der neuen Fassung.",
      ],
    },
    {
      title: "1. Definitionen",
      paragraphs: ["In diesen Bedingungen haben die folgenden Begriffe die nachstehenden Bedeutungen:"],
      bullets: [
        {
          strong: "Plattform / Tomanit:",
          text:
            "Die Systeme, Mini-App, Bots, Webdienste und sonstigen Dienste, die unter dem Namen Tomanit angeboten werden.",
        },
        { strong: "Nutzer:", text: "Jede natürliche oder juristische Person, die die Dienste der Plattform nutzt." },
        {
          strong: "Identitätsprüfung (KYC):",
          text: "Das Verfahren zur Prüfung und Bestätigung der Identität eines Nutzers gemäß den Verfahren und Anforderungen der Plattform.",
        },
        {
          strong: "Transaktion:",
          text: "Jeder Kauf, Verkauf, Transfer, Zahlung, Auszahlung, Empfang oder Umtausch von Vermögenswerten über die Plattform.",
        },
        {
          strong: "Digitaler Vermögenswert:",
          text: "Kryptowährungen und andere digitale Vermögenswerte, die zu einem bestimmten Zeitpunkt in der Liste der unterstützten Assets der Plattform stehen.",
        },
        {
          strong: "Krypto-Zahlungsgateway:",
          text:
            "Dienste, die Unternehmen Rechnungsstellung, Krypto-Zahlungseingang und Nutzung von Webdiensten ermöglichen.",
        },
      ],
    },
    {
      title: "2. Allgemeine Nutzungsbedingungen",
      bullets: [
        "Die Dienste dürfen nur von Personen genutzt werden, die nach geltendem Recht zur Nutzung solcher Dienste berechtigt sind.",
        "Sie sind für die Richtigkeit, Vollständigkeit und Aktualität aller Informationen verantwortlich, die Sie der Plattform mitteilen.",
        "Die Erstellung eines Kontos oder die Nutzung von Diensten mit Identitätsdaten Dritter, gefälschten Unterlagen oder falschen Angaben ist untersagt.",
        "Jedes Konto muss von der Person kontrolliert werden, auf deren Namen die Kontodaten registriert sind.",
        "Der Verkauf, die Vermietung, die Abtretung oder die Übertragung eines Kontos an Dritte ist streng untersagt.",
        "Sie müssen Anmeldedaten, Passwörter, Bestätigungscodes und andere Sicherheitsdaten vertraulich behandeln.",
        "Die Plattform darf den Zugang zu bestimmten Diensten oder Konten vorübergehend oder dauerhaft einschränken, aussetzen oder sperren, um Nutzer zu schützen oder gesetzliche Anforderungen zu erfüllen.",
      ],
    },
    {
      title: "3. Verifizierungsstufen und Transaktionslimits",
      paragraphs: [
        "Zur Risikosteuerung, Missbrauchsprävention und Erfüllung betrieblicher Anforderungen wird das zulässige Gesamtvolumen finanzieller Aktivitäten pro Kalendertag entsprechend Ihrer Verifizierungsstufe wie folgt festgelegt:",
      ],
      table: {
        headers: ["Verifizierungsstufe", "Tageslimit", "30-Tage-Limit"],
        rows: [
          {
            level: "Basis (ohne KYC)",
            amount: "500,000",
            unit: "Toman",
            monthly: "5,000,000",
          },
          {
            level: "Stufe 1",
            amount: "5,000,000",
            unit: "Toman",
            monthly: "100,000,000",
          },
          {
            level: "Stufe 2",
            amount: "50,000,000",
            unit: "Toman",
            monthly: "1,000,000,000",
          },
        ],
      },
      paragraphsAfter: [
        "Diese Limits sind interne betriebliche Schwellenwerte. Nach einer Rial-Einzahlung sind Krypto-Auszahlungen 72 Stunden eingeschränkt; Krypto-Ein- und -Auszahlungen unterliegen dieser Sperre nicht. Zusätzliche Verifizierung kann auch innerhalb des Limits verlangt werden.",
      ],
    },
    {
      title: "4. Identitätsprüfung",
      bullets: [
        "Die Bereitstellung oder Fortführung bestimmter Dienste setzt eine erfolgreich abgeschlossene Identitätsprüfung voraus.",
        "Identitätsinformationen und Unterlagen müssen ausschließlich Ihnen gehören.",
        "Unvollständige, falsche oder fremde Angaben können die Verifizierung stoppen oder Kontobeschränkungen zur Folge haben.",
        "Die Plattform kann bei Bedarf zusätzliche Unterlagen oder Informationen anfordern.",
        "Ein abgeschlossener Verifizierungsprozess garantiert nicht, dass alle Transaktionen ausgeführt werden oder Sicherheitslimits entfallen.",
        "Identitätsdaten werden nur im Rahmen von Gesetz, Datenschutzrichtlinie und Sicherheitsanforderungen der Plattform verarbeitet.",
      ],
    },
    {
      title: "5. Regeln für Zahlungen in Rial",
      bullets: [
        "Zahlungen in Rial sind nur über von der Plattform genehmigte Zahlungsmethoden und Konten zulässig.",
        "Die Nutzung einer Bankkarte, eines Kontos oder Zahlungsmittels eines Dritten kann zur Aussetzung oder Prüfung der Transaktion führen.",
        "Stimmen Angaben des Zahlers nicht mit dem Kontoinhaber überein, setzt die Plattform die Transaktion bis zur Klärung aus.",
        "Unzulässige Zahlungsmethoden, verdächtige Zahlungen, gefälschte Angaben oder Versuche, Zahlungslimits zu umgehen, sind untersagt.",
        "Sie sind für die Richtigkeit der eingegebenen Zahlungsinformationen verantwortlich.",
        "Bei Bankfehlern, Ausfällen des Zahlungsnetzes oder fehlerhafter Buchung wird der endgültige Status anhand der Plattformaufzeichnungen und Daten der Zahlungsdienstleister festgelegt.",
      ],
    },
    {
      title: "6. Geldwäschebekämpfung und verbotene Aktivitäten",
      paragraphs: ["Die Nutzung der Plattform für Folgendes ist streng untersagt:"],
      bullets: [
        "Geldwäsche und Finanzierung illegaler Aktivitäten",
        "Betrug, Diebstahl, Phishing und verwandte Straftaten",
        "Diebstahl von Bankdaten oder Handel mit Kartendaten",
        "Verwendung von Tatmitteln oder Erlösen aus Straftaten",
        "Umgehung rechtlicher oder finanzieller Beschränkungen",
        "Nutzung fremder Konten oder mehrerer Konten zur Umgehung von Limits",
        "Schein- oder fingierte Transaktionen",
        "Jede Handlung, die gegen geltende Gesetze und Vorschriften verstößt",
      ],
      paragraphsAfter: [
        "Die Plattform kann Transaktionen, die technisch, finanziell oder verhaltensbezogen ungewöhnlich oder verdächtig erscheinen, zur weiteren Prüfung aussetzen und bestimmte Dienste bis zum Abschluss der Prüfung einschränken.",
      ],
    },
    {
      title: "7. Verdächtige Transaktionen",
      paragraphs: [
        "Bei ungewöhnlichem Transaktionsvolumen, plötzlicher Kontaktivität, abnormalen Mustern mit mehreren Konten, Versuchen, Limits zu überschreiten, Verbindungen zu risikoreichen Quellen oder Zielen, Abweichungen zwischen Identitäts- und Finanzdaten, Geldeingängen oder -ausgängen von mehreren Personen ohne nachvollziehbare Begründung oder anderem verdächtigem Verhalten kann die Plattform zusätzliche Unterlagen verlangen, das Konto vorübergehend einschränken, Transaktionen stoppen, die Herkunft der Mittel prüfen und weitere Vorsichtsmaßnahmen ergreifen.",
      ],
    },
    {
      title: "8. Anti-Phishing- und Betrugsrichtlinie",
      paragraphs: [
        "Tomanit wird Sie niemals per privater Nachricht oder inoffizieller Kanäle um Folgendes bitten: Passwörter, Login-Codes, SMS- oder Telegram-Bestätigungscodes, Wallet-Wiederherstellungsphrasen, private Schlüssel, vollständige Kartendaten, zweite Passwörter oder CVV2 sowie Überweisungen an Adressen, die von unbekannten Konten mitgeteilt wurden.",
        "Vor jeder Zahlung oder Übertragung digitaler Vermögenswerte müssen Sie Ziel und Transaktionsdetails sorgfältig prüfen. Verluste durch Überweisungen an Personen oder Adressen außerhalb des offiziellen Plattformprozesses – einschließlich Täuschung, Phishing oder Fahrlässigkeit des Nutzers – trägt die Plattform nicht, sofern nicht geltendes Recht eine unmittelbare Haftung der Plattform vorsieht.",
      ],
    },
    {
      title: "9. Offizielle Kanäle",
      paragraphs: [
        "Dienste und Mitteilungen der Plattform dürfen nur über offiziell veröffentlichte Kanäle und Adressen bezogen werden. Allein die Bezeichnung eines Kontos, Bots, Kanals, einer Website oder Person als Tomanit-Vertreter macht diese nicht offiziell. Vor dem Senden von Geldern oder der Offenlegung sensibler Informationen muss die Echtheit des Ziels geprüft werden.",
      ],
    },
    {
      title: "10. Kryptowährungstransaktionen",
      bullets: [
        "An ein Blockchain-Netzwerk übermittelte Transaktionen sind je nach Netzwerkstatus häufig unwiderruflich.",
        "Die Wahl des richtigen Netzwerks, der Zieladresse und des Asset-Typs liegt in Ihrer Verantwortung.",
        "Das Senden von Assets im falschen Netzwerk kann zu dauerhaftem Verlust führen.",
        "Die Plattform haftet nicht für Transaktionen an falsche Adressen oder Netzwerke, außer soweit gesetzlich vorgeschrieben.",
        "Bestätigungszeiten hängen von Netzwerkbedingungen, erforderlichen Bestätigungen, Auslastung und anderen technischen Faktoren ab.",
        "Netzwerkgebühren und damit verbundene Kosten können vom Transaktionsbetrag abgezogen oder separat berechnet werden.",
      ],
    },
    {
      title: "11. Preise und Umrechnungskurse",
      paragraphs: [
        "Kauf-, Verkaufs- und Umrechnungskurse werden von der Plattform festgelegt und Ihnen zum Zeitpunkt der Transaktion angezeigt. Aufgrund von Marktschwankungen kann sich der Kurs zwischen Preisansicht und Abschluss ändern. Ist ein Kurs für einen bestimmten Zeitraum fixiert, gilt er bis zum Ende dieses Zeitraums.",
      ],
    },
    {
      title: "12. Stornierung, Erstattung und Korrektur",
      paragraphs: [
        "Nach Übermittlung einer Kryptotransaktion an das Netzwerk ist eine Stornierung möglicherweise nicht mehr möglich. Wenn eine Transaktion noch nicht verarbeitet wurde oder eine Erstattung nach internen Verfahren möglich ist, wird Ihr Antrag geprüft. Jede Rückzahlung hängt von der Prüfung der Mittelherkunft, der Transaktionshistorie und des Kontostatus ab; Netzwerk- oder Betriebsgebühren können gegebenenfalls vom Erstattungsbetrag abgezogen werden.",
      ],
    },
    {
      title: "13. Kontosicherheit",
      paragraphs: ["Sie müssen:"],
      bullets: [
        "Ihre Anmeldedaten nicht an Dritte weitergeben;",
        "Sichere Geräte und Umgebungen nutzen;",
        "Sich nicht über unbekannte oder inoffizielle Links anmelden;",
        "Login- oder Bestätigungscodes nicht an andere senden;",
        "Verdächtige Aktivitäten unverzüglich dem Support melden.",
      ],
      paragraphsAfter: [
        "Bei Anzeichen unbefugten Zugriffs darf die Plattform Kontaktivitäten vorübergehend einschränken, um Ihre Vermögenswerte zu schützen.",
      ],
    },
    {
      title: "14. Mehrfachkonten und Limitumgehung",
      paragraphs: [
        "Das Erstellen oder Betreiben mehrerer Konten zur Umgehung von Transaktionslimits oder Verifizierungsanforderungen, das Aufteilen von Transaktionen, die Nutzung fremder Identitäten, der Missbrauch von Anreizprogrammen oder das Verbergen der tatsächlichen Herkunft oder des Bestimmungsorts von Geldern ist untersagt. Die Plattform kann verknüpfte Konten prüfen und bei Bedarf einschränken oder sperren.",
      ],
    },
    {
      title: "15. Krypto-Zahlungsgateway für Unternehmen",
      paragraphs: [
        "Unternehmen, die den Webdienst oder das Zahlungsgateway der Plattform nutzen, müssen:",
      ],
      bullets: [
        "Korrekte und aktuelle Unternehmensinformationen bereitstellen;",
        "Den Webdienst nur für zulässige Tätigkeiten nutzen;",
        "Rechnungsdaten korrekt erfassen und keine Scheinrechnungen ausstellen;",
        "Webdienst-Schlüssel und Zugangsdaten vertraulich behandeln;",
        "Das Gateway nicht für illegale Aktivitäten nutzen.",
      ],
      paragraphsAfter: [
        "Bei verdächtiger Aktivität kann die Plattform den Webdienst-Schlüssel, das Konto oder zugehörige Rechnungen vorübergehend deaktivieren.",
      ],
    },
    {
      title: "16. Verantwortung der Händler",
      paragraphs: [
        "Der Händler ist für Qualität, Lieferung, Inhalt und Rechtmäßigkeit der über sein Gateway angebotenen Waren oder Dienstleistungen verantwortlich. Tomanit stellt nur die Zahlungsinfrastruktur bereit und haftet nicht für Art oder Leistung der Waren und Dienstleistungen des Händlers, außer wenn das Gesetz eine unmittelbare Haftung vorsieht. Die korrekte Erfassung von Bestelldetails, Beträgen, Bestell-IDs und Zahlungsstatus obliegt dem Händler.",
      ],
    },
    {
      title: "17. Verbotene Gateway-Nutzung",
      paragraphs: [
        "Die Nutzung des Plattform-Gateways für nach geltendem Recht illegale Tätigkeiten oder solche, die ein ungewöhnliches Risiko für Plattform, Zahlungsnetzwerk oder Nutzer darstellen, ist untersagt. Die Plattform kann eine separate Liste verbotener oder eingeschränkter Aktivitäten veröffentlichen und aktualisieren.",
      ],
    },
    {
      title: "18. Einschränkung, Aussetzung und Sperrung",
      paragraphs: [
        "Bei Verstößen gegen die Bedingungen, falschen Angaben, verdächtiger Aktivität, Betrugsverdacht, Umgehung von Limits, Sicherheitsmeldungen, missbräuchlicher Nutzung, gesetzlichen Anforderungen oder Aufforderungen zuständiger Behörden sowie bei Sicherheitsrisiken für Nutzer oder Plattform darf Tomanit ein Konto oder Teile der Dienste vorübergehend einschränken oder aussetzen. Nach Möglichkeit wird Ihnen der Grund der Einschränkung mitgeteilt.",
      ],
    },
    {
      title: "19. Prüfung der Mittelherkunft",
      paragraphs: [
        "Bei bestimmten Transaktionen kann die Plattform Unterlagen oder Informationen zur Herkunft der Mittel, zum Zweck der Transaktion oder zum Verhältnis zwischen Zahler und Empfänger anfordern. Die Verweigerung erforderlicher Angaben kann zu anhaltenden Transaktions- oder Kontobeschränkungen führen.",
      ],
    },
    {
      title: "20. Gebühren",
      paragraphs: [
        "Gebühren für jeden Dienst werden vor der Transaktion oder im entsprechenden Bereich mitgeteilt. Die Plattform kann Gebühren je nach Transaktionsart, Asset, Netzwerk, Volumen und betrieblichen Bedingungen ändern. Die bei Abschluss der Transaktion angewandte Gebühr ist maßgeblich für diese Transaktion.",
      ],
    },
    {
      title: "21. Technische Störungen und höhere Gewalt",
      paragraphs: [
        "Die Plattform unternimmt angemessene Anstrengungen für stabile Dienste; Störungen in Blockchain-Netzwerken, Telegram, Banken oder Zahlungsnetzwerken, Cyberangriffe, Infrastrukturprobleme, Internetausfälle, Fehler Dritter oder Notfallsituationen können jedoch Verzögerungen oder Ausfälle verursachen. Die Plattform haftet für Folgen solcher Faktoren nur im gesetzlich vorgesehenen Umfang.",
      ],
    },
    {
      title: "22. Verantwortung des Nutzers",
      paragraphs: [
        "Über Ihr Konto durchgeführte Aktivitäten liegen in Ihrer Verantwortung, es sei denn, unbefugter Zugriff ohne Ihr Verschulden wird nachweislich festgestellt. Sie müssen die für Ihre Tätigkeit geltenden Gesetze einhalten und die Dienste nicht in einer Weise nutzen, die Rechte Dritter oder geltende Vorschriften verletzt.",
      ],
    },
    {
      title: "23. Datenschutz und Datensicherheit",
      paragraphs: [
        "Nutzerinformationen werden gemäß der Datenschutzrichtlinie der Plattform erhoben, verarbeitet und gespeichert und können zur Erbringung von Diensten, Identitätsprüfung, Kontosicherheit, Betrugsprävention, Transaktionsprüfung, Support und Erfüllung gesetzlicher Pflichten verwendet werden. Wenn Gesetz oder zuständige Behörden es verlangen, können relevante Informationen an die zuständigen Stellen weitergegeben werden.",
      ],
    },
    {
      title: "24. Annahme der Bedingungen",
      paragraphs: [
        "Mit der Kontoerstellung, dem Zugang zur Mini-App, Transaktionen oder der Nutzung eines Dienstes bestätigen Sie, dass:",
      ],
      bullets: [
        "Sie diesen Text gelesen haben und die Nutzungsbedingungen akzeptieren;",
        "Ihre Angaben richtig sind und Ihnen gehören;",
        "Sie die Verantwortung für die Sicherheit Ihres Kontos übernehmen;",
        "Sie die Dienste nicht für illegale oder verbotene Aktivitäten nutzen werden.",
      ],
    },
    {
      title: "25. Recht zur Änderung der Bedingungen",
      paragraphs: [
        "Die Plattform darf Bedingungen, Transaktionslimits, Gebühren, Verifizierungsverfahren und Servicebedingungen ändern oder aktualisieren. Die neue Fassung ersetzt die vorherige ab dem Zeitpunkt der Bekanntgabe oder Veröffentlichung, je nach Fall.",
      ],
    },
    {
      title: "26. Kontakt zum Support",
      paragraphs: [
        "Bei verdächtiger Aktivität, unbefugten Auszahlungen, Phishing, Betrug oder anderen Transaktionsproblemen melden Sie dies umgehend über die offiziellen Support-Kanäle in der Mini-App und auf der offiziellen Website der Plattform. Offizieller Support wird ausschließlich über diese Kanäle bereitgestellt.",
      ],
    },
    {
      title: "Sicherheitshinweis",
      danger: true,
      paragraphs: [
        "Geben Sie niemals Passwort, Login-Code, Bestätigungscode, Wallet-Wiederherstellungsphrase oder privaten Schlüssel an Dritte weiter. Der offizielle Tomanit-Support benötigt niemals Ihre Wiederherstellungsphrase oder Ihren privaten Schlüssel für Kontovorgänge.",
        "Prüfen Sie vor jeder Übertragung digitaler Vermögenswerte sorgfältig Asset-Name, Netzwerk, Zieladresse und Betrag. Blockchain-Transaktionen können unwiderruflich sein. Die Sicherheit von Konto und Anmeldedaten liegt in Ihrer Verantwortung.",
      ],
    },
  ],
  endNote: "Ende der Nutzungsbedingungen",
};


export const TERMS_BY_LOCALE: Record<LocaleCode, TermsDoc> = {
  fa: TERMS_FA,
  en: TERMS_EN,
  ar: TERMS_AR,
  zh: TERMS_ZH,
  ru: TERMS_RU,
  de: TERMS_DE,
};

export function getTermsContent(locale: LocaleCode): TermsDoc {
  return TERMS_BY_LOCALE[locale] ?? TERMS_BY_LOCALE.fa;
}

