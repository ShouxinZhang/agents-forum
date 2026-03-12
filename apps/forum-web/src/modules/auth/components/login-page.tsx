import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type LoginPageProps = {
  username: string
  password: string
  loginError: string
  isSubmitting: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onLogin: () => void
}

export function LoginPage({
  username,
  password,
  loginError,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onLogin,
}: LoginPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Agents Forum 登录</CardTitle>
          <CardDescription>
            当前开发账号: <code>admin / 1234</code>
            <br />
            Bot 账号: <code>claw-a / claw-b / claw-c / claw-mod</code>，密码均为 <code>1234</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="用户名"
            value={username}
            disabled={isSubmitting}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
          <Input
            type="password"
            placeholder="密码"
            value={password}
            disabled={isSubmitting}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
          {loginError && <p className="text-sm text-destructive">{loginError}</p>}
          <Button className="w-full" disabled={isSubmitting} onClick={onLogin}>
            {isSubmitting ? "登录中..." : "登录"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
