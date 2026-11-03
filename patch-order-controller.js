const fs = require('fs');
const f = 'src/modules/order/order.controller.js';
let s = fs.readFileSync(f, 'utf8');
const fn = `
const trackOrder = asyncHandler(async (req, res) => {
  const { orderNumber, phone, email } = req.query;
  const data = await orderService.trackOrder(orderNumber, phone, email);
  return successResponse(res, 'Order tracked successfully', data);
});

`;
s = s.replace('module.exports', fn + 'module.exports');
s = s.replace('generateInvoice };', 'generateInvoice, trackOrder };');
fs.writeFileSync(f, s);
console.log('done');