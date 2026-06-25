import { AuthToken } from './index';
import { supabaseAdmin } from '@/lib/supabase-admin';

export class AuthTokenManager {
  private static toModel(db: any): AuthToken {
    return {
      id: db.id,
      merchantId: db.merchant_id,
      authorizedAppId: db.authorized_app_id,
      salesChannelId: db.sales_channel_id,
      type: db.type,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
      deleted: db.deleted,

      accessToken: db.access_token,
      tokenType: db.token_type,
      expiresIn: db.expires_in,
      expireDate: db.expire_date,
      refreshToken: db.refresh_token,
      scope: db.scope,
    };
  }

  static async get(
    authorizedAppId: string,
  ): Promise<AuthToken | undefined> {
    const { data, error } = await supabaseAdmin
      .from('auth_tokens')
      .select('*')
      .eq('authorized_app_id', authorizedAppId)
      .single();

    if (error || !data) return undefined;

    return this.toModel(data);
  }

  static async put(
    token: AuthToken,
  ): Promise<AuthToken> {
    const payload = {
      id: token.id,
      merchant_id: token.merchantId,
      authorized_app_id: token.authorizedAppId,
      sales_channel_id: token.salesChannelId,
      type: token.type,
      deleted: token.deleted ?? false,

      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      expire_date: token.expireDate,
      refresh_token: token.refreshToken,
      scope: token.scope,
    };

    const { data, error } = await supabaseAdmin
      .from('auth_tokens')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.toModel(data);
  }

  static async delete(
    authorizedAppId: string,
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('auth_tokens')
      .update({
        deleted: true,
      })
      .eq('authorized_app_id', authorizedAppId);

    if (error) throw error;
  }

 static async list(): Promise<AuthToken[]> {
  const result = await supabaseAdmin
    .from('auth_tokens')
    .select('*');

  console.log('SUPABASE RAW:', result);

  if (result.error) {
    console.error(result.error);
    return [];
  }

  return result.data.map(this.toModel);
}
}