module.exports = {
  NextRequest: class NextRequest {},
  NextResponse: {
    json: vi.fn(),
    redirect: vi.fn(),
    next: vi.fn(),
  },
};
