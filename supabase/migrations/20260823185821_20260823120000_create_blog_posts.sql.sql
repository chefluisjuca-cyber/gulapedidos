/*
# Create blog_posts table for Gula Pedidos Blog/CMS

1. New Tables
- `blog_posts`
  - `id` (uuid, primary key)
  - `title` (text, not null) — post title
  - `slug` (text, unique, not null) — SEO-friendly URL slug
  - `category` (text, not null) — category badge (Gestão, Delivery, Equipamentos, etc.)
  - `excerpt` (text) — short summary for cards
  - `content` (text) — full article content in Markdown
  - `cover_image_url` (text) — cover image URL
  - `read_time` (text) — estimated reading time (e.g. "5 min")
  - `status` (text, default 'draft') — 'draft' or 'published'
  - `published_at` (timestamptz) — when the post was published
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Indexes
- Unique index on `slug` for fast lookups and SEO-friendly URLs
- Index on `status` for filtering published/draft
- Index on `published_at` for ordering by most recent

3. Security (RLS)
- Enable RLS on `blog_posts`.
- Public read access for published posts (anon + authenticated) — blog is public content.
- Authenticated users can insert, update, delete — CMS is protected by auth.
- Draft posts are only visible to authenticated users.

4. Trigger
- `auto_update_updated_at` trigger to keep `updated_at` in sync.

5. Seed Data
- 3 published posts as specified in the requirements.
*/

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'Gestão',
  excerpt text,
  content text,
  cover_image_url text,
  read_time text DEFAULT '5 min',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
DROP POLICY IF EXISTS "public_read_published_blog_posts" ON blog_posts;
CREATE POLICY "public_read_published_blog_posts"
ON blog_posts FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Authenticated can read all posts (including drafts)
DROP POLICY IF EXISTS "auth_read_all_blog_posts" ON blog_posts;
CREATE POLICY "auth_read_all_blog_posts"
ON blog_posts FOR SELECT
TO authenticated
USING (true);

-- Authenticated can insert posts
DROP POLICY IF EXISTS "auth_insert_blog_posts" ON blog_posts;
CREATE POLICY "auth_insert_blog_posts"
ON blog_posts FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated can update posts
DROP POLICY IF EXISTS "auth_update_blog_posts" ON blog_posts;
CREATE POLICY "auth_update_blog_posts"
ON blog_posts FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- Authenticated can delete posts
DROP POLICY IF EXISTS "auth_delete_blog_posts" ON blog_posts;
CREATE POLICY "auth_delete_blog_posts"
ON blog_posts FOR DELETE
TO authenticated
USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
BEFORE UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed 3 published posts (idempotent: only insert if slug doesn't exist)
INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Impressora de comanda 80mm vs. Impressora de Etiqueta: Qual a melhor para seu restaurante?',
  'impressora-comanda-etiqueta-delivery',
  'Equipamentos',
  'Comanda térmica ou etiqueta adesiva? Entenda as diferenças, custos e qual escolher para otimizar seu delivery e cozinha.',
  '## A decisão que impacta sua operação

Escolher entre impressora de comanda 80mm e impressora de etiqueta é uma das decisões mais importantes para a eficiência do seu restaurante. Cada modelo tem vantagens específicas que podem reduzir custos ou melhorar a organização da cozinha.

### Impressora de Comanda 80mm

A impressora de comanda térmica 80mm é o padrão mais usado em cozinhas profissionais. Ela imprime em papel térmico contínuo, sem necessidade de tinta, e é ideal para:

- **Pedidos internos**: comandas para a cozinha separadas por item
- **Controle de mesa**: comanda individual por cliente
- **Cupom fiscal**: integração com sistemas de emissão de NFC-e
- **Baixo custo por impressão**: papel térmico custa em média R$ 0,02 por metro

A velocidade de impressão chega a 250mm/s, o que significa que uma comanda de 15 itens é impressa em menos de 2 segundos.

### Impressora de Etiqueta Adesiva

Já a impressora de etiqueta é fundamental para restaurantes que trabalham com:

- **Delivery**: etiqueta colada na embalagem com nome do cliente, itens e endereço
- **Controle de validade**: etiquetas de manipulação com data de abertura e vencimento
- **Identificação de produtos**: separação de porções no freezer e geladeira
- **Organização**: etiquetas de prateleira e estoque

O custo por etiqueta é um pouco maior (R$ 0,05 a R$ 0,08 por unidade), mas o benefício de organização compensa.

### Qual escolher?

A resposta curta é: **as duas**. Um restaurante bem estruturado usa impressora de comanda para a cozinha e impressora de etiqueta para delivery e controle de validade.

Se o orçamento está apertado e você precisa escolher apenas uma, considere:

1. **Se seu foco é delivery**: invista primeiro na impressora de etiqueta
2. **Se seu foco é salão**: invista primeiro na impressora de comanda 80mm
3. **Se você faz os dois**: comece pela comanda e adicione a etiqueta depois

### Modelos recomendados

Para comanda 80mm: Elgin i9, Bematech MP-4200, Daruma DR800.
Para etiqueta: Elgin L42, Zebra GK420, Bixolon SLP-D420.

### Conclusão

Não existe "melhor" de forma absoluta. Avalie o fluxo do seu restaurante e invista no equipamento que resolve o maior gargalo primeiro. Com o Gula Pedidos, você gerencia comandas e etiquetas em um único sistema, com impressão automática e silenciosa.',
  'https://images.unsplash.com/photo-1581291518857-4e27b48ca345?w=800&h=450&fit=crop',
  '7 min',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'impressora-comanda-etiqueta-delivery');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Como parar de depender das taxas altas dos marketplaces no delivery',
  'como-reduzir-taxas-marketplaces-delivery',
  'Delivery',
  'Marketplaces cobram até 30% de comissão. Veja como montar um delivery próprio e reduzir custos sem perder vendas.',
  '## O problema das taxas de marketplace

Você já parou para calcular quanto paga de comissão para marketplaces de delivery? Se você faturar R$ 10.000 por mês em delivery, pode estar pagando R$ 2.500 a R$ 3.000 apenas em comissões. Isso é o lucro de uma semana inteira.

### Por que os marketplaces cobram tanto

Marketplaces justificam a comissão alta com:

- Logística de entrega (em alguns casos)
- Visibilidade da plataforma
- Pagamento processado
- Suporte ao cliente

Mas a verdade é que você está pagando pelo **tráfego** — pelos clientes que encontram seu restaurante na plataforma. E esse mesmo tráfego pode ser construído por você.

### Como reduzir essa dependência

#### 1. Crie seu próprio canal de pedidos

Com um cardápio digital por QR Code e um sistema de delivery próprio, você recebe pedidos diretamente do cliente, sem intermediários. A comissão cai para zero.

#### 2. Use o marketplace como aquisição, não como canal principal

Quando um cliente pedir pelo marketplace, inclua na embalagem um flyer com QR Code para seu cardápio digital. Ofereça 5% de desconto no primeiro pedido direto. O custo do desconto é menor que a comissão do marketplace.

#### 3. Invista em fidelidade

Um programa de cashback simples — "a cada 10 pedidos, ganhe R$ 20 de desconto" — custa 2% do ticket médio e mantém o cliente voltando pelo seu canal.

#### 4. Tenha seu próprio motoboy

Para restaurantes com volume de delivery médio, um motoboy próprio custa entre R$ 1.500 e R$ 2.500 por mês. Se você faz mais de 150 entregas por mês, sai mais barato que o marketplace.

### O cálculo real

| Canal | Comissão | 100 pedidos/mês (R$ 40 ticket) |
|-------|----------|-------------------------------|
| Marketplace | 25% | R$ 1.000 |
| Delivery próprio | 0% + motoboy | R$ 0 comissão |
| Marketplace + próprio | Misto | R$ 500 (equilíbrio) |

### Conclusão

Não precisa sair dos marketplaces do dia para a noite. Comece montando seu canal paralelo, migre clientes gradualmente e reduza a dependência mês a mês. O Gula Pedidos oferece cardápio digital, delivery próprio com rastreio e programa de fidelidade — tudo integrado.',
  'https://images.unsplash.com/photo-1526367790999-015b8c8b9b9b?w=800&h=450&fit=crop',
  '6 min',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'como-reduzir-taxas-marketplaces-delivery');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Cardápio Digital por QR Code: Como enxugar custos com equipe sem perder a qualidade',
  'cardapio-digital-qr-code-reducao-custos',
  'Gestão',
  'O cardápio por QR Code elimina a necessidade de garçom para anotar pedidos, reduz erros e acelera o atendimento.',
  '## A revolução silenciosa do QR Code

O cardápio digital por QR Code não é mais uma novidade — é o padrão. Restaurantes que ainda usam cardápio impresso e anotação manual estão perdendo tempo e dinheiro.

### Quanto custa o atendimento manual

Um garçom gasta em média 5 minutos para anotar um pedido de uma mesa de 4 pessoas. Em um restaurante com 20 mesas e 2 garçons, isso significa:

- 20 mesas x 5 minutos = 100 minutos de anotação por rodada
- Com 3 rodadas no almoço: 300 minutos = 5 horas
- Custo do garçom: R$ 15/hora = R$ 75/dia só em anotação

Com QR Code, o cliente faz o pedido sozinho e ele chega direto na cozinha. O garçom é liberado para tarefas que agregam valor: entregar pedidos, limpar mesas, atender dúvidas.

### Como funciona o cardápio digital

1. **Cliente escaneia o QR Code** na mesa com o celular
2. **Vê o cardápio completo** com fotos, descrições e preços
3. **Monta o pedido** selecionando itens e personalizando
4. **Envia o pedido** que chega instantaneamente na cozinha
5. **Acompanha o status** em tempo real (recebido, em preparo, pronto)

### Redução de erros

A anotação manual tem uma taxa de erro de 8-12% (item errado, observação esquecida, preço desatualizado). Com o cardápio digital, o erro cai para menos de 1% porque:

- O cliente vê exatamente o que pediu
- As observações são digitadas, não interpretadas
- Os preços estão sempre atualizados
- Não há risco de letra ilegível

### Economia real

| Item | Antes (Manual) | Depois (QR Code) |
|-----|----------------|-------------------|
| Garçons necessários | 3 | 2 |
| Erros de pedido | 10% | <1% |
| Tempo de anotação | 5 min/mesa | 0 min/mesa |
| Reimpressão de cardápio | R$ 200/mês | R$ 0 |
| Custo mensal | R$ 4.500 | R$ 3.000 |

### Como implementar

Com o Gula Pedidos, a implementação leva menos de 1 hora:

1. Cadastre seus produtos com fotos e preços
2. Gere os QR Codes das mesas automaticamente
3. Imprima e cole os QR Codes nas mesas
4. Pronto — os clientes já podem pedir

### Conclusão

O cardápio digital por QR Code é a mudança de maior impacto custo-benefício que um pequeno restaurante pode fazer. Reduz custos, elimina erros, acelera o atendimento e melhora a experiência do cliente. E com o Gula Pedidos, tudo isso custa apenas R$ 69,99 por mês.',
  'https://images.unsplash.com/photo-1556745757-8d76bdb698a3?w=800&h=450&fit=crop',
  '5 min',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'cardapio-digital-qr-code-reducao-custos');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Como acabar com o caos na fila de espera do seu restaurante no fim de semana',
  'como-organizar-a-fila-de-espera-do-restaurante',
  'Operação',
  'Mantenha os clientes satisfeitos na recepção, reduza desistências na porta e automatize o atendimento em dias de pico sem complicação.',
  '## O problema da fila no fim de semana

Todo restaurante já viveu essa cena: sábado à noite, lotação máxima, e uma fila de clientes esperando na porta sem nenhuma organização. Pessoas ansiosas, sem saber quanto tempo vão esperar, e sem nenhuma informação sobre quando serão atendidas. O resultado? Desistência na porta, avaliações negativas e receita perdida.

### Por que as filas desorganizadas prejudicam seu restaurante

Uma fila mal gerenciada gera três problemas graves:

- **Desistência na porta**: clientes cansam de esperar e vão para o concorrente
- **Avaliações negativas**: a primeira impressão é de desorganização, e isso vai para o Google
- **Sobrecarga da equipe**: garçons e recepcionistas perdem tempo gerenciando a fila em vez de atender

### Como a fila virtual resolve isso

Com um sistema de fila digital via QR Code, o cliente chega, escaneia o código na entrada e entra na fila pelo celular. Ele recebe:

1. **Posição em tempo real**: "Você é o 4º da fila"
2. **Tempo estimado de espera**: "Aproximadamente 18 minutos"
3. **Notificação no WhatsApp**: quando a mesa estiver pronta, ele recebe um alerta

Isso significa que o cliente pode ir a um bar próximo, tomar um drink, ou simplesmente esperar no carro — sem precisar ficar de pé na porta.

### Os números falam por si

| Cenário | Fila manual | Fila virtual |
|---------|------------|--------------|
| Desistência na porta | 15-25% | 3-5% |
| Tempo médio de espera percebido | 40 min | 25 min |
| Avaliações negativas no Google | Frequentes | Raras |
| Ocupação da recepcionista | 100% | 20% |

### Como implementar em 30 minutos

1. **Cadastre seu restaurante** no Gula Pedidos
2. **Gere os QR Codes** da fila e cole na entrada
3. **Configure as mensagens** automáticas de WhatsApp
4. **Pronto** — os clientes entram na fila sozinhos e são chamados automaticamente

### Conclusão

A fila de espera não precisa ser um problema. Com a tecnologia certa, ela se transforma em uma experiência organizada que mantém o cliente feliz e aumenta a taxa de conversão. O Gula Pedidos oferece fila virtual completa com notificação por WhatsApp, painel de chamada em tempo real e gestão de prioridade conforme a Lei nº 14.626 — tudo por apenas R$ 69,99/mês. Teste 7 dias grátis, sem cartão de crédito.',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=450&fit=crop',
  '4 min de leitura',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'como-organizar-a-fila-de-espera-do-restaurante');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Engenharia de Cardápio: Como montar um menu enxuto e de alta margem no delivery',
  'como-montar-um-cardapio-lucrativo-para-delivery',
  'Gestão',
  'Aprenda a destacar os pratos mais lucrativos no seu cardápio digital, enxugar tempo de preparo na cozinha e aumentar o ticket médio.',
  '## O que é engenharia de cardápio

Engenharia de cardápio é a análise sistemática de cada item do seu menu para identificar quais pratos trazem mais lucro e quais estão sugando sua margem. Não se trata de cortar pratos aleatoriamente, mas de usar dados para tomar decisões estratégicas.

### Os 4 quadrantes de um cardápio

Todo prato do seu menu se encaixa em um de quatro quadrantes:

1. **Estrelas**: alta margem + alta popularidade — mantenha e destaque
2. **Cavalo de batalha**: baixa margem + alta popularidade — otimize o custo
3. **Quebra-cabeças**: alta margem + baixa popularidade — reposicione no cardápio
4. **Cachorros quentes**: baixa margem + baixa popularidade — considere remover

### Como aplicar no delivery

No delivery, o cardápio digital é sua vitrine. Cada item precisa ter foto, descrição clara e posicionamento estratégico.

#### 1. Destaque as estrelas no topo

Os pratos mais lucrativos e populares devem aparecer nos primeiros 3 itens da categoria. O cliente raramente rola a tela inteira — os primeiros itens têm 70% mais chance de serem pedidos.

#### 2. Use fotos profissionais

Um prato com foto vende 3x mais que o mesmo prato sem foto. Não precisa de estúdio — uma boa luz natural e um celular de boa câmera resolvem.

#### 3. Enxugue o menu

Um cardápio com 50 itens dilui a atenção e aumenta o tempo de preparo. Cardápios enxutos (15-25 itens) têm:

- Cozinha mais rápida (menos itens para treinar a equipe)
- Menos desperdício de insumos
- Maior giro de estoque
- Ticket médio mais alto (cliente decide mais rápido)

### O cálculo de margem

| Item | Preço de venda | Custo dos ingredientes | Margem | Pedidos/mês |
|------|---------------|----------------------|--------|-------------|
| X-Salada Especial | R$ 32 | R$ 11 | 66% | 200 |
| X-Bacon Simples | R$ 24 | R$ 9 | 63% | 150 |
| Refrigerante Lata | R$ 8 | R$ 4 | 50% | 400 |

O refrigerante tem baixa margem mas alto volume — é um "cavalo de batalha" que mantém o ticket médio alto.

### Conclusão

Um cardápio bem estruturado pode aumentar seu lucro em 15-25% sem precisar atrair mais clientes. Analise seus dados, destaque as estrelas, remova os cachorros quentes e use fotos de qualidade. Com o Gula Pedidos, você tem um cardápio digital completo com fotos, categorias organizadas e destaque automático dos pratos mais vendidos — tudo por apenas R$ 69,99/mês. Teste 7 dias grátis, sem cartão de crédito.',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=450&fit=crop',
  '6 min de leitura',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'como-montar-um-cardapio-lucrativo-para-delivery');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Impressora de comanda 80mm vs. Impressora de Etiqueta: Qual a melhor para seu restaurante?',
  'impressora-comanda-80mm-vs-impressora-etiqueta',
  'Equipamentos',
  'Entenda a diferença entre impressoras de comanda e de etiqueta, e descubra qual você precisa no seu restaurante para cada tipo de uso.',
  '## A confusão mais comum na hora de comprar equipamentos

Muitos donos de restaurante chegam na loja de suprimentos e ficam em dúvida: preciso de uma impressora de comanda 80mm ou uma impressora de etiqueta 50x40? A resposta curta é: provavelmente as duas. Mas vamos explicar quando usar cada uma.

### Impressora de Comanda 80mm

A impressora de comanda térmica 80mm é o clássico "cubinho" que todo restaurante conhece. Ela imprime em papel contínuo (bobina) e é usada para:

- **Comandas de cozinha**: o pedido vai para a cozinha impresso
- **Cupons fiscais / recibos**: comprovante para o cliente
- **Fechamento de mesa**: resumo da conta

**Características:**
- Largura de impressão: 80mm (papel térmico contínuo)
- Não usa etiqueta adesiva — apenas papel
- Velocidade alta (250mm/s ou mais)
- Conexão USB, Bluetooth ou rede

### Impressora de Etiqueta 50x40 ou 60x40

A impressora de etiqueta térmica é diferente: ela imprime em etiquetas adesivas de tamanho reduzido, ideais para colar em potes, marmitas e embalagens.

**Características:**
- Largura de impressão: 50mm ou 60mm (etiqueta adesiva)
- Imprime etiquetas com data de validade, lote, responsável
- Mais lenta que a de comanda (não precisa de alta velocidade)
- Conexão USB ou Bluetooth

### Comparativo direto

| Característica | Comanda 80mm | Etiqueta 50x40 |
|---------------|-------------|----------------|
| Tipo de papel | Bobina contínua | Etiqueta adesiva |
| Uso principal | Comandas e recibos | Validade e identificação |
| Tamanho médio | 80mm largura | 50x40mm ou 60x40mm |
| Velocidade | 250+ mm/s | 70-100 mm/s |
| Preço médio | R$ 250-400 | R$ 180-350 |
| Necessária para | Pedidos e caixa | Segurança alimentar |

### Qual comprar primeiro?

Se você está começando agora:

1. **Primeiro**: impressora de comanda 80mm (essencial para pedidos)
2. **Segundo**: impressora de etiqueta (essencial para conformidade sanitária)

Se você já tem comanda e quer etiquetas de validade, a boa notícia é que o Gula Etiquetas funciona com impressoras de etiqueta genéricas USB ou Bluetooth — não precisa de modelo caro ou específico.

### Conclusão

As duas impressoras têm funções completamente diferentes e complementares. A de comanda atende o fluxo de pedidos; a de etiqueta garante conformidade sanitária. Com o Gula Etiquetas, você imprime etiquetas de validade 60x40 ou 50x40 direto do navegador do celular ou PC, por apenas R$ 49,99/mês. Teste 7 dias grátis, sem cartão de crédito.',
  'https://images.unsplash.com/photo-1581291518857-4e27b48ff3e1?w=800&h=450&fit=crop',
  '5 min de leitura',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'impressora-comanda-80mm-vs-impressora-etiqueta');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Como evitar multas da ANVISA na manipulação de alimentos',
  'como-evitar-multas-anvisa-manipulacao-alimentos',
  'Tecnologia',
  'Multas da vigilância sanitária podem chegar a R$ 15 mil. Aprenda como se proteger com boas práticas de etiquetagem e manipulação.',
  '## O risco real das multas da vigilância sanitária

A Vigilância Sanitária (VISA) pode aplicar multas que variam de R$ 2.000 a R$ 15.000 dependendo da infração e do município. As infrações mais comuns em restaurantes são:

- Falta de etiquetas de validade em alimentos abertos
- Validade calculada incorretamente
- Ausência do nome do responsável pela manipulação
- Embalagens sem data de abertura

### O que a RDC 216/2004 exige

A Resolução RDC 216 da ANVISA estabelece que todos os alimentos manipulados devem ter:

1. **Data de preparo/abertura** — quando o produto foi aberto ou preparado
2. **Data de validade** — prazo máximo para consumo
3. **Identificação do produto** — nome claro do alimento
4. **Responsável** — nome de quem manipulou ou abriu

Sem esses quatro itens, você já está passível de multa.

### Os alimentos que mais geram multas

| Alimento | Prazo típico de validade após abertura |
|---------|---------------------------------------|
| Arroz cozido | 3 dias refrigerado |
| Feijão cozido | 3 dias refrigerado |
| Molho de tomate aberto | 5 dias refrigerado |
| Maionese caseira | 24 horas |
| Carne cruda descongelada | 24 horas |
| Sopa/Caldo | 3 dias refrigerado |

O problema é que muitos funcionários não sabem esses prazos de cabeça e acabam colocando "7 dias" em tudo — o que está errado e gera multa.

### Como a etiquetagem correta protege seu negócio

A etiqueta correta precisa conter:

```
Produto: Arroz Branco Cozido
Abertura: 25/08/2025 14:30
Validade: 28/08/2025 14:30
Responsável: Maria Silva
Lote: 001
```

Com o Gula Etiquetas, a IA calcula a validade automaticamente com base no tipo de alimento e preenche todos os campos da etiqueta em segundos. Você não precisa decorar prazos nem depender do critério do funcionário.

### Checklist anti-multa

- [ ] Todas as embalagens abertas têm etiqueta de validade
- [ ] O prazo está correto conforme o tipo de alimento
- [ ] O nome do responsável está na etiqueta
- [ ] A data de abertura está registrada
- [ ] As etiquetas estão legíveis e fixadas corretamente
- [ ] Não há fita crepe ou caneta borrada substituindo etiquetas

### Conclusão

A maior parte das multas da vigilância sanitária em restaurantes é evitável com etiquetagem correta. O problema não é falta de vontade — é falta de informação precisa sobre prazos. O Gula Etiquetas resolve isso com IA que conhece as normas e calcula a validade automaticamente, por apenas R$ 49,99/mês. Teste 7 dias grátis, sem cartão de crédito.',
  'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=800&h=450&fit=crop',
  '6 min de leitura',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'como-evitar-multas-anvisa-manipulacao-alimentos');

INSERT INTO blog_posts (title, slug, category, excerpt, content, cover_image_url, read_time, status, published_at)
SELECT
  'Regras de etiquetagem para produtos abertos e manipulados na cozinha',
  'regras-etiquetagem-produtos-abertos-manipulados-cozinha',
  'Operação',
  'Tudo o que você precisa saber sobre as regras de etiquetagem de produtos abertos, manipulados e industrializados na cozinha profissional.',
  '## Por que a etiquetagem é obrigatória

Quando você abre um produto industrializado ou prepara um alimento na cozinha, ele deixa de ter a validade original da embalagem. A partir desse momento, a validade passa a ser calculada com base nas normas sanitárias — e essa informação precisa estar visível na embalagem.

### Produtos industrializados abertos

Produtos que vêm da indústria (maionese, molho de tomate, queijo fatiado, etc.) têm validade na embalagem fechada. Mas quando você abre, a validade muda:

| Produto | Validade fechado | Validade após abertura (refrigerado) |
|---------|-----------------|--------------------------------------|
| Maionese industrial | 3-4 meses | 5 dias |
| Molho de tomate | 12 meses | 5 dias |
| Queijo fatiado | 90 dias | 5 dias |
| Presunto | 90 dias | 3 dias |
| Leite UHT | 3-6 meses | 2 dias |

### Produtos manipulados (preparados na cozinha)

Alimentos preparados no restaurante têm prazos muito mais curtos:

| Produto | Validade refrigerado |
|---------|---------------------|
| Arroz cozido | 3 dias |
| Feijão cozido | 3 dias |
| Carne assada | 3 dias |
| Salada pronta | 24 horas |
| Tempero pronto | 2 dias |
| Caldo/sopa | 3 dias |

### O que deve conter na etiqueta

A etiqueta de validade precisa ter, no mínimo:

1. **Nome do produto** — identificação clara
2. **Data de abertura/preparo** — dia e hora
3. **Data de validade** — dia e hora limite para consumo
4. **Nome do responsável** — quem abriu/preparou
5. **Lote** (opcional mas recomendado) — para rastreabilidade

### Erros comuns que geram autuação

- **Fita crepe com caneta**: ilegível após um dia de freezer
- **"Validade genérica"**: colocar 7 dias em tudo sem distinguir o produto
- **Falta do nome do responsável**: a vigilância exige identificação
- **Etiqueta sem hora**: só a data não é suficiente em alguns municípios
- **Etiqueta soltando**: etiquetas não adesivas que caem no alimento

### Como o Gula Etiquetas resolve

Com o Gula Etiquetas, você:

1. Seleciona o produto (ex: "Arroz cozido")
2. A IA calcula a validade automaticamente (3 dias refrigerado)
3. A etiqueta é impressa com todos os campos obrigatórios
4. Cola na embalagem e pronto — conformidade total

Não precisa decorar prazos, não precisa depender do critério do funcionário, não precisa de fita crepe.

### Conclusão

A etiquetagem correta é a diferença entre uma cozinha organizada e uma cozinha passível de multa. Com o Gula Etiquetas, você tem cálculo automático de validade por IA, impressão térmica em etiquetas 60x40 ou 50x40, e todos os campos obrigatórios preenchidos automaticamente — tudo por apenas R$ 49,99/mês. Teste 7 dias grátis, sem cartão de crédito.',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=450&fit=crop',
  '5 min de leitura',
  'published',
  now()
WHERE NOT EXISTS (SELECT 1 FROM blog_posts WHERE slug = 'regras-etiquetagem-produtos-abertos-manipulados-cozinha');