import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { acceptInvite } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { getMyOrganization } from '../services/organizationService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const acceptInviteSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

export const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
  });

  const onSubmit = async (data: AcceptInviteFormData) => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await acceptInvite(token || '', data.password);
      const { user, tokens } = response;
      
      login(user, tokens);
      
      try {
        const org = await getMyOrganization();
        updateUser({ orgName: org.name });
      } catch (err) {
        console.error('Failed to fetch organization:', err);
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid or expired invitation token');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return <div className="text-center">Invalid invitation link</div>;
  }

  return (
    <div className="w-full max-w-md px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-2xl">Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-2 sm:p-3 text-xs sm:text-sm text-red-600">
                {error}
              </div>
            )}
            
            <Input 
              label="Password" 
              type="password" 
              placeholder="Create a password"
              {...register('password')}
              error={errors.password?.message}
              className="text-sm sm:text-base"
            />
            
            <Input 
              label="Confirm Password" 
              type="password" 
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
              className="text-sm sm:text-base"
            />
            
            <Button type="submit" className="w-full" isLoading={isLoading}>
              <span className="hidden sm:inline">Create Account</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </form>
          
          <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm">
            <a href="/login" className="text-blue-600 hover:text-blue-700">
              Back to login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
