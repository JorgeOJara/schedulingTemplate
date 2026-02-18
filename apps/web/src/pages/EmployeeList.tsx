import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

const fetchEmployees = async (): Promise<Employee[]> => {
  const response = await api.get('/org/me/employees');
  return response.data;
};

export const EmployeeList = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: employees, isLoading } = useQuery({
    queryKey: queryKeys.organizations.employees('me'),
    queryFn: fetchEmployees,
  });

  const filteredEmployees = employees?.filter(employee => 
    employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Employees</h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 max-w-md w-full">
          <Input 
            placeholder="Search employees..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filteredEmployees?.length ?? 0} Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Email</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Role</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-slate-200">
                     {filteredEmployees?.map((employee) => (
                       <tr key={employee.id} className="hover:bg-slate-50">
                         <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                           <div className="flex items-center">
                             <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold text-sm sm:text-base">
                               {employee.firstName[0]}{employee.lastName[0]}
                             </div>
                             <div className="ml-3 sm:ml-4">
                               <div className="text-sm font-medium text-slate-900">
                                 {employee.firstName} {employee.lastName}
                               </div>
                             </div>
                           </div>
                         </td>
                         <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-slate-500 hidden sm:table-cell">
                           {employee.email}
                         </td>
                         <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-slate-500 hidden sm:table-cell capitalize">
                           {employee.role}
                         </td>
                         <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                           <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${
                             employee.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                           }`}>
                             {employee.active ? 'Active' : 'Inactive'}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
           </CardContent>
         </Card>
     </div>
   );
};

export default EmployeeList;
