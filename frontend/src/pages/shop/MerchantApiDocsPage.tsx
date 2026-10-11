import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../../components/Notification";
import ArrowBackIcon from "../../components/icons/ArrowBackIcon";
import Copy01Icon from "../../components/icons/hugeicons/Copy01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { useTelegramBackButton } from "../../hooks/useTelegramBackButton";
import { getApiBaseUrl, getAppUrl } from "../../lib/api";
import "./MerchantApiDocs.css";

type SectionId =
  | "intro"
  | "openapi"
  | "auth"
  | "create"
  | "status"
  | "callback"
  | "links";

const SECTION_IDS: SectionId[] = [
  "intro",
  "openapi",
  "auth",
  "create",
  "status",
  "callback",
  "links",
];

type HttpMethod = "GET" | "POST";

function CodePanel({
  title,
  code,
  onCopy,
  copyLabel,
}: {
  title: string;
  code: string;
  onCopy: (text: string) => void;
  copyLabel: string;
}) {
  return (
    <div className="mapi-docs__code">
      <div className="mapi-docs__code-bar">
        <span className="mapi-docs__code-title">{title}</span>
        <button
          type="button"
          className="mapi-docs__copy"
          aria-label={copyLabel}
          onClick={() => onCopy(code)}
        >
          <Copy01Icon variant="bulk-rounded" size={13} color="currentColor" />
        </button>
      </div>
      <pre dir="ltr">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodPath({ method, path }: { method: HttpMethod; path: string }) {
  return (
    <div className="mapi-docs__method-path" dir="ltr">
      <span className={`mapi-docs__verb mapi-docs__verb--${method.toLowerCase()}`}>
        {method}
      </span>
      <code className="mapi-docs__route">{path}</code>
    </div>
  );
}

type Field = {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
};

function FieldTable({
  fields,
  requiredLabel,
  optionalLabel,
  nameLabel,
  typeLabel,
  descLabel,
}: {
  fields: Field[];
  requiredLabel: string;
  optionalLabel: string;
  nameLabel: string;
  typeLabel: string;
  descLabel: string;
}) {
  return (
    <div className="mapi-docs__table-wrap">
      <table className="mapi-docs__table">
        <thead>
          <tr>
            <th>{nameLabel}</th>
            <th>{typeLabel}</th>
            <th>{descLabel}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td>
                <code dir="ltr">{f.name}</code>
                <span
                  className={`mapi-docs__flag${
                    f.required ? " mapi-docs__flag--req" : " mapi-docs__flag--opt"
                  }`}
                >
                  {f.required ? requiredLabel : optionalLabel}
                </span>
              </td>
              <td>
                <code dir="ltr" className="mapi-docs__type">
                  {f.type}
                </code>
              </td>
              <td>{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MerchantApiDocsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [active, setActive] = useState<SectionId>("intro");
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const jumpingRef = useRef(false);

  const goBack = useCallback(() => {
    navigate("/shop/api");
  }, [navigate]);
  useTelegramBackButton(goBack);

  /** Keep nav highlight in sync with the section currently in view. */
  useEffect(() => {
    const scroller = contentScrollRef.current;
    if (!scroller) return;

    const syncActive = () => {
      if (jumpingRef.current) return;
      const rootTop = scroller.getBoundingClientRect().top;
      const marker = rootTop + 56;
      let best: SectionId = SECTION_IDS[0]!;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(`mapi-${id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= marker) best = id;
      }
      setActive((prev) => (prev === best ? prev : best));
    };

    scroller.addEventListener("scroll", syncActive, { passive: true });
    syncActive();
    return () => scroller.removeEventListener("scroll", syncActive);
  }, []);

  /** Nudge active chip into view on mobile only if it is clipped. */
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    if (window.matchMedia("(min-width: 760px)").matches) return;

    const chip = sidebar.querySelector<HTMLElement>(
      `.mapi-docs__nav-item[data-section="${active}"]`,
    );
    if (!chip) return;

    const pad = 12;
    const sideRect = sidebar.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    let delta = 0;
    if (chipRect.left < sideRect.left + pad) {
      delta = chipRect.left - sideRect.left - pad;
    } else if (chipRect.right > sideRect.right - pad) {
      delta = chipRect.right - sideRect.right + pad;
    }
    if (Math.abs(delta) < 1) return;
    sidebar.scrollBy({ left: delta, behavior: "smooth" });
  }, [active]);

  const apiBase = useMemo(() => {
    const fromEnv = getApiBaseUrl();
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    if (typeof window !== "undefined") {
      return `${window.location.origin.replace(/\/+$/, "")}/api`;
    }
    return "https://api.example.com/api";
  }, []);

  const appBase = useMemo(() => {
    const fromEnv = getAppUrl();
    if (fromEnv) return fromEnv.replace(/\/+$/, "");
    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/+$/, "");
    }
    return "https://app.example.com";
  }, []);

  const basePath = `${apiBase}/merchant/v1`;
  const openApiUrl = `${basePath}/openapi.json`;
  const staticOpenApiUrl = `${appBase}/openapi/merchant-api.json`;
  const llmsUrl = `${appBase}/llms.txt`;

  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const add = (rel: string, href: string, type?: string) => {
      const el = document.createElement("link");
      el.rel = rel;
      el.href = href;
      if (type) el.type = type;
      document.head.appendChild(el);
      links.push(el);
    };
    add("alternate", openApiUrl, "application/json");
    add("alternate", staticOpenApiUrl, "application/json");
    add("describedby", llmsUrl, "text/plain");
    return () => {
      for (const el of links) el.remove();
    };
  }, [llmsUrl, openApiUrl, staticOpenApiUrl]);

  const createBody = useMemo(
    () =>
      JSON.stringify(
        {
          amountToman: 250000,
          phone: "09121234567",
          telegramId: 123456789,
          expiresInMinutes: 15,
          callbackUrl: "https://yoursite.com/hooks/tomanit-invoice",
        },
        null,
        2,
      ),
    [],
  );

  const createRequest = useMemo(
    () =>
      [
        `curl -X POST '${basePath}/invoices' \\`,
        `  -H 'Authorization: Bearer TomanIt:{shopId}:{token}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${createBody.replace(/\n/g, "").replace(/\s+/g, " ")}'`,
      ].join("\n"),
    [basePath, createBody],
  );

  const createResponse = useMemo(
    () =>
      JSON.stringify(
        {
          invoice: {
            id: "1",
            code: "TMNIT-100001",
            payToken: "100001482391",
            amountToman: 250000,
            status: "open",
            phone: "09121234567",
            telegramId: "123456789",
            callbackUrl: "https://yoursite.com/hooks/tomanit-invoice",
            webUrl: `${appBase}/pay/100001482391`,
            miniAppUrl: "https://t.me/YourBot/app?startapp=inv_100001482391",
            url: `${appBase}/pay/100001482391`,
            paidAt: null,
            expiresAt: "2026-04-08T11:15:00.000Z",
            createdAt: "2026-04-08T11:00:00.000Z",
          },
        },
        null,
        2,
      ),
    [appBase],
  );

  const statusRequest = useMemo(
    () =>
      [
        `curl -X GET '${basePath}/invoices/TMNIT-100001' \\`,
        `  -H 'Authorization: Bearer TomanIt:{shopId}:{token}'`,
      ].join("\n"),
    [basePath],
  );

  const callbackBody = useMemo(
    () =>
      JSON.stringify(
        {
          event: "invoice.paid",
          invoice: {
            id: "1",
            code: "TMNIT-100001",
            payToken: "100001482391",
            amountToman: 250000,
            status: "paid",
            phone: "09121234567",
            telegramId: "123456789",
            trackId: "987654",
            paidAt: "2026-04-08T11:08:00.000Z",
            expiresAt: "2026-04-08T11:15:00.000Z",
            webUrl: `${appBase}/pay/100001482391`,
            miniAppUrl: "https://t.me/YourBot/app?startapp=inv_100001482391",
          },
        },
        null,
        2,
      ),
    [appBase],
  );

  const navGroups: {
    title: string;
    items: { id: SectionId; label: string; method?: HttpMethod }[];
  }[] = [
    {
      title: t("myShop.apiDocsNavGuide"),
      items: [
        { id: "intro", label: t("myShop.apiDocsOverviewTitle") },
        { id: "openapi", label: t("myShop.apiDocsOpenApiTitle") },
        { id: "auth", label: t("myShop.apiDocsAuthTitle") },
      ],
    },
    {
      title: t("myShop.apiDocsNavInvoices"),
      items: [
        { id: "create", label: t("myShop.apiDocsCreateTitle"), method: "POST" },
        { id: "status", label: t("myShop.apiDocsStatusTitle"), method: "GET" },
        { id: "callback", label: t("myShop.apiDocsCallbackTitle") },
        { id: "links", label: t("myShop.apiDocsLinksTitle") },
      ],
    },
  ];

  const createFields: Field[] = [
    {
      name: "amountToman",
      type: "integer",
      required: true,
      desc: t("myShop.apiDocsParamAmount"),
    },
    {
      name: "expiresInMinutes",
      type: "integer",
      required: true,
      desc: t("myShop.apiDocsParamExpires"),
    },
    {
      name: "callbackUrl",
      type: "string (uri)",
      required: true,
      desc: t("myShop.apiDocsParamCallback"),
    },
    {
      name: "phone",
      type: "string",
      desc: t("myShop.apiDocsParamPhone"),
    },
    {
      name: "telegramId",
      type: "integer | string",
      desc: t("myShop.apiDocsParamTelegramId"),
    },
  ];

  const linkFields: Field[] = [
    {
      name: "webUrl",
      type: "string",
      desc: t("myShop.apiDocsLinkWeb"),
    },
    {
      name: "url",
      type: "string",
      desc: t("myShop.apiDocsLinkWeb"),
    },
    {
      name: "miniAppUrl",
      type: "string",
      desc: t("myShop.apiDocsLinkMini"),
    },
  ];

  const copy = async (text: string) => {
    haptic("light");
    try {
      await navigator.clipboard.writeText(text);
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const jump = (id: SectionId) => {
    haptic("light");
    setActive(id);
    const scroller = contentScrollRef.current;
    const target = document.getElementById(`mapi-${id}`);
    if (!scroller || !target) return;
    jumpingRef.current = true;
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      12;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    window.setTimeout(() => {
      jumpingRef.current = false;
    }, 450);
  };

  return (
    <div className="mapi-docs">
      <header className="mapi-docs__top">
        <div className="mapi-docs__top-row">
          <button
            type="button"
            className="mapi-docs__back"
            onClick={() => {
              haptic("light");
              goBack();
            }}
            aria-label={t("common.back")}
          >
            <ArrowBackIcon width={18} height={18} />
          </button>
          <div className="mapi-docs__brand">
            <img
              className="mapi-docs__logo"
              src="/Tomanit.webp"
              alt=""
              width={36}
              height={36}
              decoding="async"
            />
            <div className="mapi-docs__brand-text">
              <p className="mapi-docs__product">{t("myShop.apiDocsProduct")}</p>
              <h1 className="mapi-docs__title">{t("myShop.apiDocsReference")}</h1>
            </div>
          </div>
          <span className="mapi-docs__version">{t("myShop.apiDocsVersion")}</span>
        </div>
      </header>

      <div className="mapi-docs__layout">
        <aside
          ref={sidebarRef}
          className="mapi-docs__sidebar"
          aria-label={t("myShop.apiDocsTitle")}
        >
          {navGroups.map((group) => {
            const groupActive = group.items.some((item) => item.id === active);
            return (
              <div
                key={group.title}
                className={`mapi-docs__nav-group${groupActive ? " is-active" : ""}`}
              >
                <p className="mapi-docs__nav-title">{group.title}</p>
                <ul className="mapi-docs__nav-list">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-section={item.id}
                        className={`mapi-docs__nav-item${
                          active === item.id ? " is-active" : ""
                        }`}
                        onClick={() => jump(item.id)}
                      >
                        {item.method ? (
                          <span
                            className={`mapi-docs__nav-verb mapi-docs__nav-verb--${item.method.toLowerCase()}`}
                          >
                            {item.method}
                          </span>
                        ) : (
                          <span className="mapi-docs__nav-dot" aria-hidden />
                        )}
                        <span className="mapi-docs__nav-label">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </aside>

        <div className="mapi-docs__content-scroll" ref={contentScrollRef}>
        <main className="mapi-docs__content">
          <section id="mapi-intro" className="mapi-docs__section">
            <h2 className="mapi-docs__h1">{t("myShop.apiDocsOverviewTitle")}</h2>
            <p className="mapi-docs__lead">{t("myShop.apiDocsOverviewBody")}</p>
            <p className="mapi-docs__muted">{t("myShop.apiDocsDesc")}</p>

            <div className="mapi-docs__servers">
              <div className="mapi-docs__servers-head">
                <span>{t("myShop.apiDocsBaseUrl")}</span>
                <button
                  type="button"
                  className="mapi-docs__copy mapi-docs__copy--inline"
                  aria-label={t("common.copy")}
                  onClick={() => void copy(basePath)}
                >
                  <Copy01Icon variant="bulk-rounded" size={13} color="currentColor" />
                </button>
              </div>
              <code className="mapi-docs__server" dir="ltr">
                {basePath}
              </code>
            </div>
          </section>

          <section id="mapi-openapi" className="mapi-docs__section">
            <h2 className="mapi-docs__h1">{t("myShop.apiDocsOpenApiTitle")}</h2>
            <p className="mapi-docs__lead">{t("myShop.apiDocsOpenApiBody")}</p>
            <p className="mapi-docs__muted">{t("myShop.apiDocsOpenApiHint")}</p>

            <div className="mapi-docs__machine">
              <div className="mapi-docs__machine-row">
                <div className="mapi-docs__machine-meta">
                  <span className="mapi-docs__machine-badge">openapi.json</span>
                  <span className="mapi-docs__machine-label">
                    {t("myShop.apiDocsOpenApiLive")}
                  </span>
                </div>
                <div className="mapi-docs__machine-actions">
                  <button
                    type="button"
                    className="mapi-docs__copy mapi-docs__copy--inline"
                    aria-label={t("common.copy")}
                    onClick={() => void copy(openApiUrl)}
                  >
                    <Copy01Icon variant="bulk-rounded" size={13} color="currentColor" />
                  </button>
                  <a
                    className="mapi-docs__machine-link"
                    href={openApiUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("myShop.apiDocsOpenApiOpen")}
                  </a>
                </div>
              </div>
              <code className="mapi-docs__server" dir="ltr">
                {openApiUrl}
              </code>
            </div>

            <div className="mapi-docs__machine">
              <div className="mapi-docs__machine-row">
                <div className="mapi-docs__machine-meta">
                  <span className="mapi-docs__machine-badge mapi-docs__machine-badge--mute">
                    llms.txt
                  </span>
                  <span className="mapi-docs__machine-label">
                    {t("myShop.apiDocsLlmsLabel")}
                  </span>
                </div>
                <div className="mapi-docs__machine-actions">
                  <button
                    type="button"
                    className="mapi-docs__copy mapi-docs__copy--inline"
                    aria-label={t("common.copy")}
                    onClick={() => void copy(llmsUrl)}
                  >
                    <Copy01Icon variant="bulk-rounded" size={13} color="currentColor" />
                  </button>
                  <a
                    className="mapi-docs__machine-link"
                    href={llmsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("myShop.apiDocsOpenApiOpen")}
                  </a>
                </div>
              </div>
              <code className="mapi-docs__server" dir="ltr">
                {llmsUrl}
              </code>
            </div>
          </section>

          <section id="mapi-auth" className="mapi-docs__section">
            <h2 className="mapi-docs__h1">{t("myShop.apiDocsAuthTitle")}</h2>
            <p className="mapi-docs__lead">{t("myShop.apiDocsAuthBody")}</p>
            <div className="mapi-docs__security">
              <span className="mapi-docs__security-badge">HTTP Bearer</span>
              <code dir="ltr">Authorization: Bearer TomanIt:{"{shopId}"}:{"{token}"}</code>
            </div>
            <CodePanel
              title="Header"
              code={`Authorization: Bearer TomanIt:{shopId}:{token}`}
              onCopy={copy}
              copyLabel={t("common.copy")}
            />
          </section>

          <section id="mapi-create" className="mapi-docs__op">
            <div className="mapi-docs__op-head">
              <MethodPath method="POST" path="/merchant/v1/invoices" />
              <h2 className="mapi-docs__op-title">{t("myShop.apiDocsCreateTitle")}</h2>
              <p className="mapi-docs__lead">{t("myShop.apiDocsCreateBody")}</p>
            </div>

            <div className="mapi-docs__op-grid">
              <div className="mapi-docs__op-col">
                <h3 className="mapi-docs__h3">{t("myShop.apiDocsRequestBody")}</h3>
                <FieldTable
                  fields={createFields}
                  requiredLabel={t("myShop.apiDocsRequired")}
                  optionalLabel={t("myShop.apiDocsOptional")}
                  nameLabel={t("myShop.apiDocsColName")}
                  typeLabel={t("myShop.apiDocsColType")}
                  descLabel={t("myShop.apiDocsColDesc")}
                />
              </div>
              <div className="mapi-docs__op-col mapi-docs__op-col--code">
                <CodePanel
                  title="cURL"
                  code={createRequest}
                  onCopy={copy}
                  copyLabel={t("common.copy")}
                />
                <CodePanel
                  title={`${t("myShop.apiDocsResponseSample")} · 201`}
                  code={createResponse}
                  onCopy={copy}
                  copyLabel={t("common.copy")}
                />
              </div>
            </div>
          </section>

          <section id="mapi-status" className="mapi-docs__op">
            <div className="mapi-docs__op-head">
              <MethodPath method="GET" path="/merchant/v1/invoices/{code|payToken}" />
              <h2 className="mapi-docs__op-title">{t("myShop.apiDocsStatusTitle")}</h2>
              <p className="mapi-docs__lead">{t("myShop.apiDocsStatusBody")}</p>
            </div>

            <div className="mapi-docs__op-grid">
              <div className="mapi-docs__op-col">
                <h3 className="mapi-docs__h3">{t("myShop.apiDocsPathParams")}</h3>
                <FieldTable
                  fields={[
                    {
                      name: "code | payToken",
                      type: "string",
                      required: true,
                      desc: t("myShop.apiDocsStatusBody"),
                    },
                  ]}
                  requiredLabel={t("myShop.apiDocsRequired")}
                  optionalLabel={t("myShop.apiDocsOptional")}
                  nameLabel={t("myShop.apiDocsColName")}
                  typeLabel={t("myShop.apiDocsColType")}
                  descLabel={t("myShop.apiDocsColDesc")}
                />
              </div>
              <div className="mapi-docs__op-col mapi-docs__op-col--code">
                <CodePanel
                  title="cURL"
                  code={statusRequest}
                  onCopy={copy}
                  copyLabel={t("common.copy")}
                />
              </div>
            </div>
          </section>

          <section id="mapi-callback" className="mapi-docs__op">
            <div className="mapi-docs__op-head">
              <MethodPath method="POST" path="{callbackUrl}" />
              <h2 className="mapi-docs__op-title">{t("myShop.apiDocsCallbackTitle")}</h2>
              <p className="mapi-docs__lead">{t("myShop.apiDocsCallbackBody")}</p>
              <div className="mapi-docs__events" dir="ltr">
                <code className="mapi-docs__event">invoice.paid</code>
                <code className="mapi-docs__event">invoice.failed</code>
              </div>
            </div>
            <div className="mapi-docs__op-grid mapi-docs__op-grid--single">
              <div className="mapi-docs__op-col mapi-docs__op-col--code">
                <CodePanel
                  title={t("myShop.apiDocsCallbackSample")}
                  code={callbackBody}
                  onCopy={copy}
                  copyLabel={t("common.copy")}
                />
              </div>
            </div>
          </section>

          <section id="mapi-links" className="mapi-docs__section">
            <h2 className="mapi-docs__h1">{t("myShop.apiDocsLinksTitle")}</h2>
            <p className="mapi-docs__lead">{t("myShop.apiDocsLinksBody")}</p>
            <FieldTable
              fields={linkFields}
              requiredLabel={t("myShop.apiDocsRequired")}
              optionalLabel={t("myShop.apiDocsOptional")}
              nameLabel={t("myShop.apiDocsColName")}
              typeLabel={t("myShop.apiDocsColType")}
              descLabel={t("myShop.apiDocsColDesc")}
            />
          </section>
        </main>
        </div>
      </div>
    </div>
  );
}
