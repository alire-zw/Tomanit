import { env } from "../config/env.js";

/** Public OpenAPI 3.1 document for Merchant API (AI / codegen friendly). */
export function buildMerchantOpenApiDocument(options?: {
  apiBaseUrl?: string;
  appBaseUrl?: string;
}) {
  const apiBase = (options?.apiBaseUrl ?? env.PUBLIC_URL ?? "").replace(/\/+$/, "");
  const appBase = (options?.appBaseUrl ?? "").replace(/\/+$/, "");

  return {
    openapi: "3.1.0",
    info: {
      title: "Tomanit Merchant API",
      version: "1.0.0",
      summary: "Create and track shop payment invoices",
      description: [
        "Merchant invoice API for Tomanit shops.",
        "Authenticate with `Authorization: Bearer TomanIt:{shopId}:{token}`.",
        "Human docs: `/docs/merchant-api` on the Mini App.",
        "Machine-readable OpenAPI: this document.",
      ].join("\n\n"),
      contact: { name: "Tomanit" },
    },
    servers: [
      {
        url: `${apiBase}/merchant/v1`,
        description: "Merchant API v1",
      },
    ],
    tags: [
      {
        name: "Invoices",
        description: "Create invoices and query payment status",
      },
      {
        name: "Callbacks",
        description: "HTTPS webhooks POSTed to your callbackUrl",
      },
    ],
    components: {
      securitySchemes: {
        ShopApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "TomanIt:{shopId}:{token}",
          description:
            "Shop API key from the Mini App → Shop → API section. Format: TomanIt:{shopId}:{token}",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
          required: ["error"],
        },
        Invoice: {
          type: "object",
          properties: {
            id: { type: "string", example: "1" },
            code: {
              type: "string",
              example: "TMNIT-100001",
              description: "Stable invoice code",
            },
            payToken: {
              type: "string",
              example: "100001482391",
              description: "Current pay token used in payment URLs",
            },
            amountToman: { type: "integer", example: 250000 },
            status: {
              type: "string",
              enum: ["open", "paid", "cancelled", "expired"],
            },
            phone: { type: ["string", "null"], example: "09121234567" },
            telegramId: { type: ["string", "null"], example: "123456789" },
            callbackUrl: {
              type: ["string", "null"],
              format: "uri",
              example: "https://yoursite.com/hooks/tomanit-invoice",
            },
            webUrl: {
              type: ["string", "null"],
              format: "uri",
              description: "Browser / website payment link",
              example: appBase
                ? `${appBase}/pay/100001482391`
                : "https://app.example.com/pay/100001482391",
            },
            miniAppUrl: {
              type: ["string", "null"],
              format: "uri",
              description: "Telegram Mini App deep link",
            },
            url: {
              type: ["string", "null"],
              format: "uri",
              description: "Alias of webUrl",
            },
            paidAt: { type: ["string", "null"], format: "date-time" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "code", "payToken", "amountToman", "status", "createdAt"],
        },
        CreateInvoiceRequest: {
          type: "object",
          required: ["amountToman", "expiresInMinutes", "callbackUrl"],
          properties: {
            amountToman: {
              type: "integer",
              minimum: 10000,
              maximum: 500000000,
              description: "Invoice amount in toman",
              example: 250000,
            },
            expiresInMinutes: {
              type: "integer",
              minimum: 5,
              maximum: 25,
              description: "Invoice TTL in minutes (required, 5–25)",
              example: 15,
            },
            callbackUrl: {
              type: "string",
              format: "uri",
              description: "HTTPS URL that receives invoice.paid / invoice.failed",
              example: "https://yoursite.com/hooks/tomanit-invoice",
            },
            phone: {
              type: "string",
              nullable: true,
              description: "Optional payer mobile (09xxxxxxxxx)",
              example: "09121234567",
            },
            telegramId: {
              oneOf: [{ type: "integer" }, { type: "string" }],
              nullable: true,
              description:
                "Optional Telegram numeric user id — only that user can pay",
              example: 123456789,
            },
          },
        },
        InvoiceResponse: {
          type: "object",
          required: ["invoice"],
          properties: {
            invoice: { $ref: "#/components/schemas/Invoice" },
          },
        },
        CallbackPayload: {
          type: "object",
          required: ["event", "invoice"],
          properties: {
            event: {
              type: "string",
              enum: ["invoice.paid", "invoice.failed"],
            },
            invoice: {
              allOf: [
                { $ref: "#/components/schemas/Invoice" },
                {
                  type: "object",
                  properties: {
                    trackId: { type: ["string", "null"] },
                  },
                },
              ],
            },
          },
        },
      },
    },
    security: [{ ShopApiKey: [] }],
    paths: {
      "/invoices": {
        post: {
          tags: ["Invoices"],
          operationId: "createInvoice",
          summary: "Create invoice",
          description:
            "Creates an open payable invoice. Returns webUrl and miniAppUrl for the payer.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateInvoiceRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Invoice created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InvoiceResponse" },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "401": {
              description: "Invalid or missing API key",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/invoices/{ref}": {
        get: {
          tags: ["Invoices"],
          operationId: "getInvoice",
          summary: "Get invoice status",
          description: "Look up by payToken digits or invoice code (TMNIT-…).",
          parameters: [
            {
              name: "ref",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "payToken or TMNIT-code",
              example: "TMNIT-100001",
            },
          ],
          responses: {
            "200": {
              description: "Invoice found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InvoiceResponse" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
    "x-webhooks": {
      invoiceStatus: {
        post: {
          tags: ["Callbacks"],
          operationId: "invoiceStatusCallback",
          summary: "Payment status callback",
          description:
            "Tomanit POSTs this JSON to your callbackUrl after payment success or failure.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CallbackPayload" },
              },
            },
          },
          responses: {
            "200": { description: "Acknowledge receipt" },
          },
        },
      },
    },
  } as const;
}
