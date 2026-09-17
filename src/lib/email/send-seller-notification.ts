/**
 * Seller Payment Notification
 *
 * Sends an email to the seller when a payment is confirmed.
 * Fire-and-forget — never throws, never blocks the payment flow.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentIntent } from '@/domain/payments/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email/client';
import { paymentReceivedTemplate } from '@/lib/email/templates/payment-received';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  nwc: 'Lightning',
  lightning_address: 'Lightning',
  onchain: 'On-chain',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://orangecat.ch';

export async function sendSellerPaymentNotification(
  paymentIntent: PaymentIntent,
  supabase: SupabaseClient
): Promise<void> {
  // Skip silently if email provider isn't configured — avoids throwing in dev
  if (!isEmailConfigured()) {
    logger.info(
      'Email not configured, skipping seller notification',
      { paymentIntentId: paymentIntent.id },
      'SellerNotification'
    );
    return;
  }

  try {
    const sellerId = paymentIntent.seller_id;

    // 1. Fetch seller profile (contact_email, display_name, username)
    const { data: sellerProfile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('contact_email, display_name:name, username')
      .eq('id', sellerId)
      .single();

    // 2. Resolve email: profile.contact_email → auth.users.email fallback
    let sellerEmail = sellerProfile?.contact_email ?? null;

    if (!sellerEmail) {
      const adminClient = createAdminClient();
      const { data: authUser } = await adminClient.auth.admin.getUserById(sellerId);
      sellerEmail = authUser?.user?.email ?? null;
    }

    if (!sellerEmail) {
      logger.warn(
        'Seller has no email address — skipping payment notification',
        { sellerId, paymentIntentId: paymentIntent.id },
        'email'
      );
      return;
    }

    // 3. Resolve buyer display name (never expose buyer email)
    const { data: buyerProfile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('display_name:name, username')
      .eq('id', paymentIntent.buyer_id)
      .single();

    const buyerName = buyerProfile?.display_name || buyerProfile?.username || 'Anonymous';

    // 4. Parse entity title from description ("EntityType: Title" → "Title")
    const description = paymentIntent.description ?? '';
    const colonIndex = description.indexOf(': ');
    const entityTitle =
      colonIndex !== -1 ? description.slice(colonIndex + 2) : description || 'Item';

    // 5. Format amount
    const amountBtc = paymentIntent.amount_btc.toFixed(8);

    // 6. Map payment method
    const paymentMethod =
      PAYMENT_METHOD_LABELS[paymentIntent.payment_method] ?? paymentIntent.payment_method;

    // 7. Seller name for greeting
    const sellerName = sellerProfile?.display_name || sellerProfile?.username || 'there';

    // 8. Build and send
    const template = paymentReceivedTemplate({
      sellerName,
      entityTitle,
      amountBtc,
      buyerName,
      paymentMethod,
      dashboardUrl: `${APP_URL}/dashboard`,
    });

    const result = await sendEmail({
      to: sellerEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (!result.sent) {
      logger.warn(
        'Failed to send seller payment notification',
        { error: result.error, paymentIntentId: paymentIntent.id },
        'email'
      );
      return;
    }

    logger.info(
      'Seller payment notification sent',
      { sellerId, paymentIntentId: paymentIntent.id, to: sellerEmail },
      'email'
    );
  } catch (err) {
    // Log but never re-throw — email failure must not block payment confirmation
    logger.warn(
      'Failed to send seller payment notification',
      { err, paymentIntentId: paymentIntent.id },
      'email'
    );
  }
}
