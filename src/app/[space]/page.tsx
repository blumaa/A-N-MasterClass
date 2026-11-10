export default async function SpaceHome({ params }: PageProps<'/[space]'>) {
  const { space } = await params;
  return (
    <main>
      <h1>{space}</h1>
    </main>
  );
}
