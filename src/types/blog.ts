export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  read_time: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const BLOG_CATEGORIES = ['Gestão', 'Delivery', 'Equipamentos', 'Marketing', 'Tecnologia', 'Fidelidade', 'Operação'] as const;
