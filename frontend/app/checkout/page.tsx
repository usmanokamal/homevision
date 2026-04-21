import CheckoutClient from "./CheckoutClient";

type CheckoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const transactionId =
    getSingleParam(resolvedSearchParams._ptxn) ||
    getSingleParam(resolvedSearchParams.ptxn);

  return <CheckoutClient transactionId={transactionId} />;
}
