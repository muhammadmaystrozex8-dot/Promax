// ضع هذا الملف في مشروع Vercel بالمسار: api/compare.js
// يستخدم Gemini API (مجاني بحدود يومية) مع بحث Google مباشر - احصل على مفتاح من aistudio.google.com

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deviceOne, deviceTwo } = req.body || {};

  if (!deviceOne || !deviceTwo) {
    return res.status(400).json({ error: 'الرجاء إرسال اسم المنتجين' });
  }

  const prompt = `أنت مساعد مقارنة منتجات تقنية. قارن بين: "${deviceOne}" و "${deviceTwo}" (قد يكونا هاتفين، ساعتين ذكيتين، سماعتين، أو أي إكسسوار تقني آخر - حدد نوعهما تلقائياً).
ابحث عن المواصفات الرسمية الحقيقية والمحدّثة لهذين المنتجين.
أجب حصراً بكائن JSON صالح دون أي نص إضافي أو علامات markdown أو شرح، بهذا الشكل بالضبط:
{
  "category": "نوع المنتجين (مثال: هواتف ذكية / ساعات ذكية / سماعات)",
  "device1": {"name": "الاسم الكامل"},
  "device2": {"name": "الاسم الكامل"},
  "specs": [
    {"label": "اسم المواصفة", "value1": "قيمة المنتج الأول", "value2": "قيمة المنتج الثاني"}
  ]
}
اختر بنفسك أنسب 7 إلى 10 مواصفات لنوع هذا المنتج تحديداً (مثلاً للهواتف: الشاشة، المعالج، الرام، التخزين، الكاميرا، البطارية؛ وللساعات: الشاشة، البطارية، مقاومة الماء، المستشعرات؛ وللسماعات: نوع الاتصال، عزل الضوضاء، مدة البطارية). اكتب كل القيم بالعربية وبإيجاز شديد (أقل من 10 كلمات لكل قيمة). إذا لم تجد المنتج، اكتب "غير متوفر".`;

  try {
    const model = 'gemini-3.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'تعذّر الاتصال بخدمة الذكاء الاصطناعي' });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n');

    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(502).json({ error: 'لم يتم العثور على بيانات صالحة' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Compare handler error:', err);
    return res.status(500).json({ error: 'حدث خطأ داخلي' });
  }
}
