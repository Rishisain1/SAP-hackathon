export async function predictPurchaseOrderRisk(payload) {
  const response = await fetch('/api/predict-po-risk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.details?.fieldErrors
        ? Object.values(data.details.fieldErrors).flat().join(' ')
        : data?.message || data?.error || 'Prediction request failed.';
    throw new Error(message);
  }

  return data;
}
