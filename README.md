# IIDZII POS - نظام إدارة المبيعات الذكي

<div align="center">

![IIDZII POS](public/icon.png)

**نظام نقاط بيع ذكي متكامل — يعمل على المتصفح مباشرة**

[![Deploy to GitHub Pages](https://github.com/phonekyc/iidzii-pos/actions/workflows/deploy.yml/badge.svg)](https://github.com/imadIIDZII/iidzii-pos/actions/workflows/deploy.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

</div>

---

## ✨ المميزات الرئيسية

### 🛒 نقطة البيع (POS)
- واجهة بيع سريعة وسهلة الاستخدام
- مسح الباركود عبر الكاميرا أو الإدخال اليدوي
- دعم كامل للغة العربية (RTL)
- إدارة سلة المشتريات وإجراء خصومات
- طباعة فواتير مباشرة من المتصفح
- حساب ضريبة القيمة المضافة (TVA) تلقائياً

### 📦 إدارة المخزون
- إضافة وتعديل وحذف المنتجات
- تتبع كميات المخزون تلقائياً
- إدارة الموردين
- تصنيف المنتجات
- الباركود التلقائي للمنتجات

### 📊 لوحة التحكم
- إحصائيات المبيعات اليومية والشهرية
- رسوم بيانية تفاعلية (Recharts)
- أفضل المنتجات والزبائن
- تتبع أداء الموظفين

### 👥 إدارة الزبائن
- قاعدة بيانات الزبائن
- تتبع المشتريات والإنفاق
- البحث السريع عن الزبائن

### 💰 إدارة الديون
- تسجيل المبيعات الآجلة
- تتبع المدفوعات
- تنبيهات الديون المستحقة

### 🧾 الزكاة
- حساب زكاة التجارة تلقائياً
- تتبع الحول الهجري
- سجل سجلات الزكاة

### ⚙️ الإعدادات
- دعم متعدد اللغات (العربية، الفرنسية، الإنجليزية)
- الوضع المظلم / الفاتح
- إعدادات الطابعة الحرارية
- إدارة المستخدمين والأدوار (مدير / بائع)
- نسخ احتياطي واستعادة البيانات
- تخصيص اسم المتجر والشعار

### 🔍 مركز البحث
- بحث شامل في المنتجات والمبيعات والزبائن
- إعادة طباعة الفواتير

---

## 🚀 النشر على GitHub Pages

### المتطلبات
- حساب GitHub
- Node.js 18 أو أحدث

### طريقة النشر التلقائي عبر GitHub Actions

1. **انسخ المستودع** (Fork) أو أنشئ مستودعاً جديداً وارفع الملفات:

```bash
git clone https://github.com/imadIIDZII/iidzii-pos.git
cd iidzii-pos
```

2. **فعّل GitHub Pages** في إعدادات المستودع:
   - اذهب إلى `Settings` → `Pages`
   - اختر `GitHub Actions` كمصدر

3. **ادفع الكود** إلى فرع `main`:
```bash
git add .
git commit -m "Deploy IIDZII POS"
git push origin main
```

سيتم بناء ونشر المشروع تلقائياً على GitHub Pages عند كل دفعة إلى فرع `main`.

### طريقة النشر اليدوية

```bash
# تثبيت التبعيات
npm install

# بناء المشروع
npm run build

# النشر عبر gh-pages
npm run deploy
```

---

## 💻 التطوير المحلي

```bash
# استنساخ المشروع
git clone https://github.com/imadIIDZII/iidzii-pos.git
cd iidzii-pos

# تثبيت التبعيات
npm install

# تشغيل خادم التطوير
npm run dev
```

سيبدأ الخادم على `http://localhost:5173`

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|----------|
| ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) | واجهة المستخدم |
| ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) | لغة البرمجة |
| ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) | أداة البناء |
| ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss) | التنسيق |
| ![Recharts](https://img.shields.io/badge/Recharts-2-8884D8) | الرسوم البيانية |
| ![html5-qrcode](https://img.shields.io/badge/html5--qrcode-2-E34F26?logo=html5) | مسح الباركود |

---

## 📁 هيكل المشروع

```
iidzii-pos/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions للنشر التلقائي
├── public/
│   ├── .nojekyll           # تعطيل معالجة Jekyll
│   ├── icon.png            # أيقونة التطبيق
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker للعمل بدون إنترنت
│   └── fonts/              # الخطوط العربية
├── components/
│   ├── POS.tsx             # واجهة نقطة البيع
│   ├── Inventory.tsx       # إدارة المخزون
│   ├── Dashboard.tsx       # لوحة التحكم
│   ├── Customers.tsx       # إدارة الزبائن
│   ├── Suppliers.tsx       # إدارة الموردين
│   ├── Settings.tsx        # الإعدادات
│   ├── Login.tsx           # تسجيل الدخول
│   ├── SearchHub.tsx       # مركز البحث
│   ├── Debts.tsx           # إدارة الديون
│   ├── Zakat.tsx           # حساب الزكاة
│   ├── BarcodeScanner.tsx  # ماسح الباركود
│   ├── Calculator.tsx      # الآلة الحاسبة
│   ├── Layout.tsx          # الهيكل العام
│   ├── Logo.tsx            # الشعار
│   └── ...
├── App.tsx                 # المكون الرئيسي
├── index.tsx               # نقطة الدخول
├── index.html              # الصفحة الرئيسية
├── i18n.ts                 # ملف الترجمة
├── types.ts                # أنواع TypeScript
├── capacitor-bridge.ts     # طبقة التوافق (طباعة، حفظ، كاميرا)
├── vite.config.ts          # إعدادات Vite
├── tailwind.config.js      # إعدادات Tailwind
├── postcss.config.js       # إعدادات PostCSS
├── tsconfig.json           # إعدادات TypeScript
├── package.json            # التبعيات والسكربرتات
└── README.md               # هذا الملف
```

---

## 🔐 معلومات تسجيل الدخول الافتراضية

| الدور | اسم المستخدم | كلمة المرور |
|-------|-------------|-------------|
| مدير النظام | `admin` | `admin` |
| بائع | `seller` | `seller` |

> ⚠️ **تنبيه**: يُنصح بتغيير كلمات المرور الافتراضية فوراً بعد التثبيت.

---

## 💾 تخزين البيانات

يستخدم النظام **localStorage** لتخزين جميع البيانات محلياً في المتصفح:
- المنتجات والمخزون
- سجل المبيعات
- بيانات الزبائن والموردين
- الإعدادات والمستخدمين
- سجلات الديون والزكاة

> **ملاحظة**: البيانات مخزنة محلياً فقط. استخدم ميزة التصدير/الاستيراد في الإعدادات لإنشاء نسخ احتياطية.

---

## 📱 دعم PWA

التطبيق يدعم التثبيت كتطبيق ويب تقدمي (PWA):
- يعمل بدون اتصال بالإنترنت
- يمكن تثبيته على الشاشة الرئيسية
- متوافق مع الهواتف والأجهزة اللوحية

---

## 📄 الترخيص

هذا المشروع مرخص بموجب [GPL-3.0-or-later](LICENSE)

---

<div align="center">

**تطوير [imad IIDZII](https://github.com/imadIIDZII)**

</div>
