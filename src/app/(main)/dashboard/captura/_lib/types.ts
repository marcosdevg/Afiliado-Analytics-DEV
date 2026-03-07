export type LayoutVariant = "icons" | "scarcity";



export type CaptureSiteRow = {
  id: string;
  userid: string;
  domain: string;
  slug: string;

  title: string | null;
  description: string | null;
  whatsapp_url: string;

  button_color: string;
  active: boolean;
  expiresat: string | null;

  view_count: number;
  cta_click_count: number;

  created_at: string;
  updated_at: string;

  logopath: string | null;

  // NEW
  layout_variant: LayoutVariant | null;
  meta_pixel_id: string | null; // 👈 ADICIONAR ESTA LINHA
  buttontext?: string | null;

};
