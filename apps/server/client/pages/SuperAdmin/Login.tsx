import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { AuthUser, useAuthStore } from "@/client/store/authStore";

type LoginResponse = {
  superAdmin: { id: string; email: string; name: string };
};

export function SuperAdminLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>("/superadmin/auth/login", { email, password });
      const user: AuthUser = {
        id: response.data.data.superAdmin.id,
        name: response.data.data.superAdmin.name,
        email: response.data.data.superAdmin.email,
        role: "SUPERADMIN",
      };
      setAuth({ user });
      navigate("/superadmin", { replace: true });
    } catch {
      setError("Email yoki parol noto'g'ri");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-950">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-md bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold">SuperAdmin</h1>
        <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Parol" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        <button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Kirish</button>
      </form>
    </main>
  );
}
