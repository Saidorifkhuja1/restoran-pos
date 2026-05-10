import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { useAuthStore, AuthRestaurant, AuthUser } from "@/client/store/authStore";

type LoginResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant;
};

export function AdminLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [restaurantId, setRestaurantId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>("/auth/login", { restaurantId, pin });
      setAuth(response.data.data);
      navigate("/tables", { replace: true });
    } catch {
      setError("Restaurant ID yoki PIN noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold">RestoPOS</h1>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Restaurant ID</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-600">PIN</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value)} />
        </label>
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        <button disabled={loading} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Kirish
        </button>
      </form>
    </main>
  );
}
