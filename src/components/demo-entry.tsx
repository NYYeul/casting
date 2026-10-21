export function DemoEntry() {
  return (
    <div className="lp-cta">
      <form action="/api/demo" method="post">
        <input type="hidden" name="role" value="producer" />
        <button className="button button-primary" type="submit">
          제작자로 체험하기 →
        </button>
      </form>
      <form action="/api/demo" method="post">
        <input type="hidden" name="role" value="actor" />
        <button className="button button-outline" type="submit">
          배우로 체험하기 →
        </button>
      </form>
    </div>
  );
}
