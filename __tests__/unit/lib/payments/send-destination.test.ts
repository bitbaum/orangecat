/**
 * One Send field reads four things. What it SAYS it found is what gets paid,
 * so the classifier is tested against what people actually paste or scan.
 */

import { classifyDestination } from '@/lib/payments/send-destination';

// A real-shaped mainnet invoice prefix is enough for the parser to recognise
// the network; the data part is not validated here.
const INVOICE =
  'lnbc10u1p3xnhl2pp5j5p5xr3gcfy2svz3twtkkxf8n9w5c9e2w5nxxv5t7e6z7q3kkm9qdqqcqzpgxqyz5vqsp5';

describe('classifyDestination', () => {
  it('reads nothing from nothing', () => {
    expect(classifyDestination('   ')).toEqual({ kind: 'empty' });
  });

  it('reads an OrangeCat username, with or without the @', () => {
    expect(classifyDestination('lena')).toEqual({ kind: 'username', username: 'lena' });
    expect(classifyDestination('@lena')).toEqual({ kind: 'username', username: 'lena' });
  });

  it('reads a Lightning address as a destination, not an account', () => {
    expect(classifyDestination('lena@wallet.com')).toEqual({
      kind: 'address',
      address: 'lena@wallet.com',
    });
  });

  it('reads an invoice however a wallet packaged it', () => {
    expect(classifyDestination(INVOICE)).toEqual({ kind: 'invoice', invoice: INVOICE });
    expect(classifyDestination(`LIGHTNING:${INVOICE.toUpperCase()}`)).toEqual({
      kind: 'invoice',
      invoice: INVOICE,
    });
  });

  it('reads a scanned pay link as the person and what they asked for', () => {
    expect(classifyDestination('https://orangecat.ch/pay/lena?amount=0.0005&for=Dinner')).toEqual({
      kind: 'username',
      username: 'lena',
      amountBtc: 0.0005,
      note: 'Dinner',
    });
    expect(classifyDestination('https://orangecat.ch/pay/lena')).toEqual({
      kind: 'username',
      username: 'lena',
    });
  });

  it('leaves an unknown link for the server to refuse', () => {
    expect(classifyDestination('https://example.com/x')).toEqual({
      kind: 'username',
      username: 'https://example.com/x',
    });
  });
});
