const { getClients } = require('./_db');

exports.handler = async (event) => {
  const portalUUID = event.queryStringParameters?.id;
  if (!portalUUID) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === portalUUID);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

    // Return only safe fields for client.
    // Extended to expose Managed-Plan subscription state so client-portal.html
    // can render the Subscriber support panel for £49/mo customers.
    const monthlyInvoices = Array.isArray(client.monthlyInvoices) ? client.monthlyInvoices : [];
    const lastInvoice = monthlyInvoices.slice().sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))[0] || null;
    const overdue = monthlyInvoices.find(i => !i.paidAt && i.dueAt && new Date(i.dueAt).getTime() < Date.now()) || null;

    // Compute next-invoice date — 1st of next month if subscription is active.
    let nextInvoiceDate = null;
    if (client.subscription === 'managed') {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(1);
      d.setUTCHours(9, 0, 0, 0);
      nextInvoiceDate = d.toISOString();
    }

    // Edit credits — 1 per month included on Managed; tracked in client.editCreditsUsedThisMonth
    const editCreditsTotal = client.subscription === 'managed' ? 1 : 0;
    const editCreditsUsed  = client.editCreditsUsedThisMonth || 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: client.name,
        business_name: client.business_name,
        previewUrl: client.previewUrl,
        delivery_email: client.delivery_email,
        stage: client.stage,

        // Managed Plan extensions (consumed by Subscriber panel in client-portal.html)
        subscription: client.subscription || null,        // 'managed' | null
        liveUrl: client.liveUrl || null,                  // public URL once launched
        liveAt: client.liveAt || null,                    // ISO when launched
        nextInvoiceDate,                                   // ISO 1st of next month or null
        lastInvoice: lastInvoice ? {
          invoiceNumber: lastInvoice.invoiceNumber,
          amount: lastInvoice.amount,
          issuedAt: lastInvoice.issuedAt,
          dueAt: lastInvoice.dueAt,
          paidAt: lastInvoice.paidAt,
        } : null,
        overdueInvoice: overdue ? { invoiceNumber: overdue.invoiceNumber, dueAt: overdue.dueAt } : null,
        editCredits: { total: editCreditsTotal, used: editCreditsUsed, remaining: Math.max(0, editCreditsTotal - editCreditsUsed) },
        lastPerformanceReportAt: client.lastPerformanceReportAt || null,
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
