export async function fetchProductNameByBarcode(barcode: string): Promise<string | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
  if (!response.ok) return null;

  const data = (await response.json()) as {
    product?: { product_name?: string; product_name_en?: string };
  };

  return data.product?.product_name || data.product?.product_name_en || null;
}
