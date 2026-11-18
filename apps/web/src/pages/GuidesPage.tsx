import { Anchor, Card, SimpleGrid, Stack, Text, Title, Typography } from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, type MouseEvent } from 'react';
import { AnchorLink } from '../components/links.js';
import { GUIDES, guideBySlug, guideHtml } from '../guides/guides.js';

/** Záložka Návody: the user guides of the app. */
export function GuidesPage() {
  const navigate = useNavigate();
  return (
    <Stack>
      <Title order={2}>Návody</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {GUIDES.map((guide) => (
          <Card
            key={guide.slug}
            withBorder
            padding="lg"
            style={{ cursor: 'pointer' }}
            onClick={() => void navigate({ to: '/navody/$slug', params: { slug: guide.slug } })}
          >
            <Title order={4}>{guide.title}</Title>
            <Text size="sm" c="dimmed" mt={4}>
              {guide.description}
            </Text>
            <Anchor component="span" size="sm" mt="sm">
              Otevřít návod
            </Anchor>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export function GuidePage() {
  const { slug } = useParams({ from: '/app/navody/$slug' });
  const navigate = useNavigate();
  const guide = guideBySlug(slug);
  const html = useMemo(() => (guide ? guideHtml(guide) : ''), [guide]);
  // Links between the guides open in the app.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a[data-guide]');
    if (!link) return;
    event.preventDefault();
    void navigate({ to: '/navody/$slug', params: { slug: link.getAttribute('data-guide')! } });
    window.scrollTo(0, 0);
  };
  if (!guide) return <Text>Návod nenalezen.</Text>;
  return (
    <Stack maw={900}>
      <AnchorLink to="/navody" size="sm">
        ← Návody
      </AnchorLink>
      <Typography>
        <div data-testid="guide" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      </Typography>
    </Stack>
  );
}
