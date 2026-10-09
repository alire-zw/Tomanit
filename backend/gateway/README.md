# درگاه پرداخت یکپارچه (داخل بک‌اند)

منطق و UI درگاه پوششی داخل همین بک‌اند است — سرویس جدا لازم نیست.

## مسیرها (همان پروسس API)

| مسیر | کار |
|------|-----|
| `GET /pay/start/:trackId` | صفحه پرداخت تومانیت |
| `GET /pay/:token` | فاکتور دستی → ریدایرکت به مینی‌اپ `/p/:token` |
| `ALL /pay/api/sep/*` | پروکسی شاپرک |
| `GET /pay/assets/*` | استاتیک درگاه |

لینک پرداخت مینی‌اپ: `{MINI_APP_URL}/pay/start/{trackId}`  
لینک فاکتور دستی: `{MINI_APP_URL}/pay/{token}` (بک‌اند به `/p/{token}` می‌فرستد)  
فرانت در dev با Vite و در پروداکشن با Nginx باید `/pay` را به بک‌اند پروکسی کند (مثل `/api`).

## فایل‌ها

- `backend/gateway/` — قالب HTML، CSS/JS، lib زیبال/شاپرک
- `backend/src/routes/payShell.ts` — ثبت مسیرها روی Fastify
