import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { ApiError, api, getToken, setToken } from "../../api/client";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (getToken()) return <Navigate to="/admin/submissions" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setToken(result.token);
      navigate("/admin/submissions", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError("登录过于频繁，请稍后再试。");
      else setError("用户名或密码错误。");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <div className="mb-2 flex items-center gap-3">
            <BrandMark className="size-11" />
            <div>
              <CardTitle className="text-xl">Nyadio 管理后台</CardTitle>
              <CardDescription>登录后管理频道、标签与运行状态。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form className="grid gap-4" onSubmit={submit}>
            <Label>
          用户名
              <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </Label>
            <Label>
          密码
              <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
            </Label>
            {error && (
              <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                {error}
              </div>
            )}
            <Button disabled={pending} className="w-full">
              <LockKeyhole />
              {pending ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
