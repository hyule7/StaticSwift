const { getClients } = require('./_db');

exports.handler = async (event) => {
  const portalUUID = event.queryStringParameters?.id;
  if (!portalUUID) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

  try {
    const clients = await getClients();
    const client = clients.find(c => c.portalUUID === portalUUID);
    if (!client) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

    // Return only safe fields for client
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: client.name,
        business_name: client.business_name,
        previewUrl: client.previewUrl,
        delivery_email: client.delivery_email,
        stage: client.stage
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
