const { getClientStore, getMetaStore } = require('./_store');
const ExcelJS = require('exceljs');

exports.handler = async (event) => {
  // Simple password check
  const auth = event.headers['x-admin-password'];
  const validPw = process.env.ADMIN_PASSWORD || 'Harry2001!';
  if (auth !== validPw) return { statusCode: 401, body: 'Unauthorized' };

  try {
    const store = getClientStore();
    const { blobs } = await store.list();
    const clients = [];
    for (const { key } of blobs) {
      if (key === 'invoice_counter') continue;
      try { clients.push(await store.get(key, { type: 'json' })); } catch { continue; }
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'StaticSwift';
    wb.created = new Date();

    const darkFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF07090F' } };
    const cyanFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00C8E0' } };
    const headerFont = { bold: true, color: { argb: 'FF07090F' }, name: 'Calibri', size: 11 };

    const addHeaderRow = (sheet, cols) => {
      const row = sheet.addRow(cols);
      row.eachCell(cell => { cell.fill = cyanFill; cell.font = headerFont; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
      row.height = 24;
    };

    // Sheet 1: Pipeline
    const s1 = wb.addWorksheet('Pipeline');
    s1.columns = [
      {header:'Name',key:'name',width:20},{header:'Business',key:'biz',width:24},
      {header:'Email',key:'email',width:28},{header:'Phone',key:'phone',width:16},
      {header:'Package',key:'pkg',width:12},{header:'Value £',key:'val',width:10},
      {header:'Stage',key:'stage',width:16},{header:'Source',key:'src',width:16},
      {header:'Days',key:'days',width:8},{header:'Invoice',key:'inv',width:14},
      {header:'Notes',key:'notes',width:40},
    ];
    addHeaderRow(s1, ['Name','Business','Email','Phone','Package','Value £','Stage','Source','Days','Invoice','Notes']);
    const active = clients.filter(c => !['archived'].includes(c.stage));
    active.forEach(c => {
      const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
      s1.addRow({ name:c.name, biz:c.business_name, email:c.delivery_email, phone:c.phone||'',
        pkg:c.package==='advanced'?'Advanced':'Starter', val:(c.amount||149),
        stage:c.stage, src:c.source||'', days, inv:c.invoiceNumber||'', notes:c.notes||'' });
    });

    // Sheet 2: Completed
    const s2 = wb.addWorksheet('Completed');
    addHeaderRow(s2, ['Business','Email','Package','Amount £','Paid Date','Days to Close','Source']);
    s2.columns = [{width:24},{width:28},{width:12},{width:10},{width:14},{width:14},{width:16}];
    clients.filter(c => c.paid).forEach(c => {
      const days = c.paidAt && c.createdAt ? Math.floor((new Date(c.paidAt)-new Date(c.createdAt))/86400000) : '';
      s2.addRow([c.business_name, c.delivery_email, c.package==='advanced'?'Advanced':'Starter',
        c.amount||149, c.paidAt?new Date(c.paidAt).toLocaleDateString('en-GB'):'', days, c.source||'']);
    });

    // Sheet 3: Revenue by month
    const s3 = wb.addWorksheet('Revenue');
    addHeaderRow(s3, ['Month','Sites','Revenue £','Avg Order £','Running Total £']);
    s3.columns = [{width:14},{width:8},{width:12},{width:14},{width:16}];
    const monthMap = {};
    clients.filter(c => c.paid && c.paidAt).forEach(c => {
      const m = new Date(c.paidAt).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
      if (!monthMap[m]) monthMap[m] = { count:0, total:0 };
      monthMap[m].count++; monthMap[m].total += (c.amount||149);
    });
    let running = 0;
    Object.entries(monthMap).forEach(([m, d]) => {
      running += d.total;
      s3.addRow([m, d.count, d.total, Math.round(d.total/d.count), running]);
    });

    // Sheet 4: Support Log
    const s4 = wb.addWorksheet('Support Log');
    addHeaderRow(s4, ['Business','Email','Direction','Subject','Date']);
    s4.columns = [{width:24},{width:28},{width:12},{width:40},{width:14}];
    clients.forEach(c => {
      (c.emailLog||[]).filter(e => e.direction).forEach(e => {
        s4.addRow([c.business_name, c.delivery_email, e.direction, e.subject||e.type, e.sentAt||e.receivedAt?new Date(e.sentAt||e.receivedAt).toLocaleDateString('en-GB'):'']);
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const b64 = Buffer.from(buffer).toString('base64');
    const filename = `StaticSwift_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}"` },
      body: b64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('excel-export error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
