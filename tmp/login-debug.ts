import { POST } from "../app/api/auth/login/route";

async function run() {
  const req = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0790000000", password: "ChangeMe123!" })
  });
  const res = await POST(req);
  console.log(res.status);
  console.log(await res.text());
}

run().catch((e) => {
  console.error("SCRIPT_ERR", e);
});
