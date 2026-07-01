import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { email, customerName, rfNumber, orderNo } = body;

    if (!email || !rfNumber || !orderNo) {
      return NextResponse.json(
        { success: false, error: 'Eksik bilgi' },
        { status: 400 }
      );
    }

    const data = await resend.emails.send({
        
      from: 'ReturnFlow <onboarding@resend.dev>',
      to: ['eypsrkc@gmail.com'],
      subject: 'Yeni İade Talebi - ${rfNumber}',
      html: `
        <div style="font-family: Arial; background:#f4f5f7; padding:30px;">
          <div style="max-width:600px; margin:auto; background:white; border-radius:24px; padding:30px;">
            <h2>ReturnFlow</h2>
            <h1>İade Talebiniz Oluşturuldu</h1>
            <p>Merhaba ${customerName || ''},</p>
            <p>İade talebiniz başarıyla oluşturuldu.</p>

            <div style="background:#f4f5f7; padding:20px; border-radius:16px; margin-top:20px;">
              <p><strong>RF No:</strong> ${rfNumber}</p>
              <p><strong>Sipariş No:</strong> ${orderNo}</p>
              <p><strong>Müşteri E-posta:</strong> ${email}</p>
              <p><strong>Durum:</strong> İncelemede</p>
            </div>

            <p style="margin-top:24px;">
              Talebinizi İade Takibi sayfasından RF numaranız veya sipariş numaranız ile takip edebilirsiniz.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: 'Mail gönderilemedi' },
      { status: 500 }
    );
  }
}