import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const data = await resend.emails.send({
      from: 'ReturnFlow <onboarding@resend.dev>',
      to: ['eyupsina7@gmail.com'], // kendi mail adresin
      subject: 'ReturnFlow Test',
      html: `
        <h1>🎉 ReturnFlow</h1>
        <p>Mail sistemi başarıyla çalışıyor.</p>
      `,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error,
      },
      {
        status: 500,
      }
    );
  }
}