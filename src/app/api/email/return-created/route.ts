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
      subject: `Yeni İade Talebi - ${rfNumber}`,
      html: `
        <div style="font-family: Arial; background:#f4f5f7; padding:30px;">
          <div style="max-width:600px; margin:auto; background:white; border-radius:24px; padding:30px;">
            <h2>ReturnFlow</h2>

            <h1>Yeni İade Talebi</h1>

            <p><strong>Müşteri:</strong> ${customerName || '-'}</p>
            <p><strong>Müşteri E-posta:</strong> ${email}</p>

            <div style="background:#f4f5f7;padding:20px;border-radius:16px;margin-top:20px;">
              <p><strong>RF No:</strong> ${rfNumber}</p>
              <p><strong>Sipariş No:</strong> ${orderNo}</p>
              <p><strong>Durum:</strong> Yeni Talep</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log(
      'RESEND RESULT:',
      JSON.stringify(data, null, 2)
    );

    if (data.error) {
      console.error('RESEND ERROR:', data.error);

      return NextResponse.json(
        {
          success: false,
          error: data.error,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('MAIL ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Mail gönderilemedi',
      },
      {
        status: 500,
      }
    );
  }
}