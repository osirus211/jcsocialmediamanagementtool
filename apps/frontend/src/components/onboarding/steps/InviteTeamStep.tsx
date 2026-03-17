import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { ChevronRight, ChevronLeft, Plus, X, Mail, Users, AlertCircle } from 'lucide-react';

interface InviteTeamStepProps {
  onNext: () => void;
  onBack: () => void;
}

interface TeamMember {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

/**
 * InviteTeamStep Component
 * 
 * Fourth step - invite team members
 */
export function InviteTeamStep({ onNext, onBack }: InviteTeamStepProps) {
  const { currentStepData, updateStepData } = useOnboardingStore();
  const { currentWorkspaceId, sendEmailInvitation } = useWorkspaceStore();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTeamMember = () => {
    if (newEmail && isValidEmail(newEmail)) {
      const exists = teamMembers.some(member => member.email === newEmail);
      if (!exists) {
        setTeamMembers([...teamMembers, { email: newEmail, role: newRole }]);
        setNewEmail('');
        setNewRole('member');
      }
    }
  };

  const removeTeamMember = (email: string) => {
    setTeamMembers(teamMembers.filter(member => member.email !== email));
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInviteTeam = async () => {
    if (teamMembers.length === 0 || !currentWorkspaceId) return;
    
    setIsInviting(true);
    setError(null);
    try {
      // Send all invitations in parallel
      await Promise.all(
        teamMembers.map(member => 
          sendEmailInvitation(currentWorkspaceId, {
            email: member.email,
            role: member.role as any
          })
        )
      );
      
      updateStepData({ 
        teamMembersInvited: teamMembers.map(m => m.email) 
      });
      onNext();
    } catch (error: any) {
      console.error('Failed to invite team members:', error);
      setError(error.response?.data?.error || 'Failed to send one or more invitations. Please check the email addresses and try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleSkipStep = () => {
    updateStepData({ teamMembersInvited: [] });
    onNext();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTeamMember();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Invite Your Team
        </h2>
        <p className="text-lg text-gray-600">
          Collaborate with your team by inviting them to your workspace. You can always do this later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Add Team Member Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Add Team Members</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              
              <button
                onClick={addTeamMember}
                disabled={!newEmail || !isValidEmail(newEmail)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {newEmail && !isValidEmail(newEmail) && (
              <p className="text-sm text-red-600">Please enter a valid email address</p>
            )}
          </div>
        </div>

        {/* Team Members List */}
        {teamMembers.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-medium text-gray-900 mb-4">
              Team Members to Invite ({teamMembers.length})
            </h4>
            
            <div className="space-y-3">
              {teamMembers.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">{member.email}</div>
                      <div className="text-sm text-gray-600 capitalize">{member.role}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeTeamMember(member.email)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            💡 <strong>Tip:</strong> Team members will receive an email invitation to join your workspace. 
            You can manage roles and permissions later in your workspace settings.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={handleSkipStep}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Skip for now
          </button>
          
          {teamMembers.length > 0 ? (
            <button
              onClick={handleInviteTeam}
              disabled={isInviting}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isInviting ? 'Inviting...' : `Invite ${teamMembers.length} member${teamMembers.length > 1 ? 's' : ''}`}
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSkipStep}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}