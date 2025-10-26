import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/lib/production-logger';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Home as HomeIcon, 
  Filter, 
  MapPin, 
  DollarSign, 
  RefreshCw, 
  Download,
  Eye,
  Image as ImageIcon,
  MoreVertical,
  AlertCircle,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  User,
  Bed,
  Bath,
  Maximize
} from 'lucide-react';
import { toast } from 'sonner';

interface Property {
  id: string;
  title: string;
  description: string | null;
  location_name: string;
  price_kes: number;
  approval_status: string;
  is_active: boolean;
  created_at: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  property_type: string | null;
  images_json: any | null;
  landlord_id: string;
  rejection_reason: string | null;
  // Computed field
  images?: string[];
}

interface LandlordProfile {
  full_name: string | null;
  email: string | null;
}

export default function AdminListings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [landlords, setLandlords] = useState<Record<string, LandlordProfile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchProperties();
  }, []);

  const processPropertyImages = (imagesJson: any): string[] => {
    // Handle null or undefined
    if (!imagesJson) {
      return [];
    }

    // If it's already an array of strings, return it
    if (Array.isArray(imagesJson)) {
      return imagesJson.filter(img => typeof img === 'string');
    }

    // If it's an object with urls property
    if (typeof imagesJson === 'object' && Array.isArray(imagesJson.urls)) {
      return imagesJson.urls.filter((img: any) => typeof img === 'string');
    }

    // If it's an object with images property
    if (typeof imagesJson === 'object' && Array.isArray(imagesJson.images)) {
      return imagesJson.images.filter((img: any) => typeof img === 'string');
    }

    // Try to parse as JSON string
    if (typeof imagesJson === 'string') {
      try {
        const parsed = JSON.parse(imagesJson);
        return processPropertyImages(parsed);
      } catch {
        // If parsing fails, might be a single URL
        return [imagesJson];
      }
    }

    return [];
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      // Parse images_json to images array
      const processedData = (propertiesData || []).map(property => {
        const images = processPropertyImages(property.images_json);
        
        // Log for debugging (first property only)
        if (property === propertiesData[0] && property.images_json) {
          logger.info('Sample property image data', { 
            propertyId: property.id,
            imagesJsonType: typeof property.images_json,
            imagesJson: property.images_json,
            processedImages: images
          });
        }

        return {
          ...property,
          images
        };
      });

      setProperties(processedData);

      // Fetch landlord information
      if (propertiesData && propertiesData.length > 0) {
        const landlordIds = [...new Set(propertiesData.map(p => p.landlord_id))];
        
        const { data: landlordsData, error: landlordsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', landlordIds);

        if (landlordsError) {
          logger.warn('Error fetching landlords', { error: landlordsError });
        }

        if (landlordsData) {
          const landlordsMap: Record<string, LandlordProfile> = {};
          landlordsData.forEach(landlord => {
            landlordsMap[landlord.id] = {
              full_name: landlord.full_name,
              email: landlord.email
            };
          });
          setLandlords(landlordsMap);
        }
      }

      toast.success('Properties loaded successfully');
      console.log('Loaded properties with images:', {
        totalProperties: processedData.length,
        propertiesWithImages: processedData.filter(p => p.images && p.images.length > 0).length,
        sampleProperty: processedData[0] ? {
          id: processedData[0].id,
          title: processedData[0].title,
          imagesCount: processedData[0].images?.length || 0,
          images: processedData[0].images
        } : null
      });
    } catch (error) {
      logger.error('Error fetching properties', { error });
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalStatus = async (propertyId: string, status: string, reason?: string) => {
    try {
      const updateData: any = { 
        approval_status: status,
        is_active: status === 'approved'
      };

      if (status === 'declined' && reason) {
        updateData.rejection_reason = reason;
      }

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', propertyId);

      if (error) throw error;

      const action = status === 'approved' ? 'approved' : 'declined';
      toast.success(`Property ${action} successfully`, {
        description: status === 'approved' 
          ? 'Property is now visible to users' 
          : 'Property has been declined and is hidden',
      });
      fetchProperties();
    } catch (error) {
      logger.error('Error updating property approval status', { error, propertyId, status });
      toast.error('Failed to update property');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedProperties.length === 0) return;

    try {
      const { error } = await supabase
        .from('properties')
        .update({ 
          approval_status: 'approved',
          is_active: true
        })
        .in('id', selectedProperties);

      if (error) throw error;

      toast.success(`${selectedProperties.length} properties approved`);
      setSelectedProperties([]);
      fetchProperties();
    } catch (error) {
      logger.error('Error bulk approving properties', { error });
      toast.error('Failed to approve properties');
    }
  };

  const handleBulkReject = async () => {
    if (selectedProperties.length === 0) return;

    try {
      const { error } = await supabase
        .from('properties')
        .update({ 
          approval_status: 'declined',
          is_active: false,
          rejection_reason: 'Bulk rejection by admin'
        })
        .in('id', selectedProperties);

      if (error) throw error;

      toast.success(`${selectedProperties.length} properties declined`);
      setSelectedProperties([]);
      fetchProperties();
    } catch (error) {
      logger.error('Error bulk rejecting properties', { error });
      toast.error('Failed to decline properties');
    }
  };

  const openViewDialog = (property: Property) => {
    setSelectedProperty(property);
    setViewDialogOpen(true);
  };

  const openRejectDialog = (property: Property) => {
    setSelectedProperty(property);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const openImageViewer = (property: Property, imageIndex: number = 0) => {
    setSelectedProperty(property);
    setSelectedImageIndex(imageIndex);
    setImageViewerOpen(true);
  };

  const handleReject = async () => {
    if (!selectedProperty || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    await updateApprovalStatus(selectedProperty.id, 'declined', rejectionReason);
    setRejectDialogOpen(false);
    setRejectionReason('');
  };

  const toggleSelectProperty = (propertyId: string) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProperties.length === filteredProperties.length) {
      setSelectedProperties([]);
    } else {
      setSelectedProperties(filteredProperties.map(p => p.id));
    }
  };

  const exportProperties = () => {
    const csv = [
      ['Title', 'Location', 'Price (KES)', 'Status', 'Bedrooms', 'Bathrooms', 'Landlord', 'Created'].join(','),
      ...filteredProperties.map(property => [
        property.title,
        property.location_name || 'N/A',
        property.price_kes || 0,
        property.approval_status,
        property.bedrooms || 0,
        property.bathrooms || 0,
        landlords[property.landlord_id]?.full_name || 'N/A',
        new Date(property.created_at).toLocaleDateString(),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `properties-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Properties exported successfully');
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      !search ||
      property.title?.toLowerCase().includes(search.toLowerCase()) ||
      property.location_name?.toLowerCase().includes(search.toLowerCase()) ||
      landlords[property.landlord_id]?.full_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || property.approval_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusStats = () => {
    return {
      total: properties.length,
      pending: properties.filter(p => p.approval_status === 'pending').length,
      approved: properties.filter(p => p.approval_status === 'approved').length,
      declined: properties.filter(p => p.approval_status === 'declined').length,
    };
  };

  const stats = getStatusStats();

  const nextImage = () => {
    if (selectedProperty?.images && selectedImageIndex < selectedProperty.images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted/50 rounded-lg animate-shimmer"></div>
          <div className="h-5 w-64 bg-muted/30 rounded animate-shimmer"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
        <Card className="border-border/50">
          <CardHeader>
            <div className="h-6 w-32 bg-muted/50 rounded animate-shimmer"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-muted/20 rounded animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <HomeIcon className="h-6 w-6 text-primary" />
          </div>
          Property Listings
        </h1>
        <p className="text-muted-foreground mt-1">
          Review property photos and details • {filteredProperties.length} properties shown
        </p>
      </div>

      {/* Status Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total', value: stats.total, color: 'primary', icon: HomeIcon },
          { label: 'Pending Review', value: stats.pending, color: 'warning', icon: Filter },
          { label: 'Approved', value: stats.approved, color: 'success', icon: CheckCircle },
          { label: 'Declined', value: stats.declined, color: 'destructive', icon: XCircle },
        ].map((stat, index) => (
          <Card key={stat.label} className="border-border/50 hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-${stat.color}/10`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selectedProperties.length > 0 && (
        <Card className="border-primary/50 shadow-glow animate-fade-up" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                <span className="text-primary font-bold">{selectedProperties.length}</span> property{selectedProperties.length > 1 ? 'ies' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkApprove}
                  className="hover:bg-success/10 hover:text-success hover:border-success/50"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkReject}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedProperties([])}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Card */}
      <Card className="border-border/50 shadow-soft animate-fade-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">All Listings</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchProperties}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportProperties}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, location, or landlord..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-10">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProperties.length === filteredProperties.length && filteredProperties.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Photos</TableHead>
                  <TableHead className="font-semibold">Property</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="font-semibold">Price</TableHead>
                  <TableHead className="font-semibold">Details</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-muted/50">
                          <HomeIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">No listings found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProperties.map((property, index) => (
                    <TableRow 
                      key={property.id} 
                      className="group hover:bg-accent/50 transition-all duration-200 border-b border-border/30 animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedProperties.includes(property.id)}
                          onCheckedChange={() => toggleSelectProperty(property.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {property.images && property.images.length > 0 ? (
                            <>
                              <button
                                onClick={() => openImageViewer(property, 0)}
                                className="relative h-16 w-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105"
                              >
                                <img
                                  src={property.images[0]}
                                  alt={property.title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="h-5 w-5 text-white" />
                                </div>
                              </button>
                              {property.images.length > 1 && (
                                <button
                                  onClick={() => openImageViewer(property, 1)}
                                  className="relative h-16 w-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105"
                                >
                                  {property.images.length > 2 ? (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <div className="text-center">
                                        <ImageIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                                        <span className="text-xs font-semibold">+{property.images.length - 1}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <img
                                        src={property.images[1]}
                                        alt={property.title}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="h-5 w-5 text-white" />
                                      </div>
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="max-w-[200px]">
                          <div className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                            {property.title}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" />
                            {landlords[property.landlord_id]?.full_name || 'Unknown'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="line-clamp-1">{property.location_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>KES {property.price_kes?.toLocaleString() || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {property.bedrooms && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-3.5 w-3.5" />
                              {property.bedrooms}
                            </div>
                          )}
                          {property.bathrooms && (
                            <div className="flex items-center gap-1">
                              <Bath className="h-3.5 w-3.5" />
                              {property.bathrooms}
                            </div>
                          )}
                          {property.square_feet && (
                            <div className="flex items-center gap-1">
                              <Maximize className="h-3.5 w-3.5" />
                              {property.square_feet}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {property.approval_status === 'approved' && (
                          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors font-medium">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {property.approval_status === 'pending' && (
                          <Badge variant="outline" className="border-warning text-warning hover:bg-warning/10 transition-colors font-medium">
                            <div className="h-1.5 w-1.5 rounded-full bg-warning mr-1.5 animate-pulse"></div>
                            Pending
                          </Badge>
                        )}
                        {property.approval_status === 'declined' && (
                          <Badge variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 transition-colors font-medium">
                            <XCircle className="h-3 w-3 mr-1" />
                            Declined
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:scale-110 transition-all duration-200"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openViewDialog(property)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openImageViewer(property, 0)}>
                              <ImageIcon className="h-4 w-4 mr-2" />
                              View Photos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {property.approval_status !== 'approved' && (
                              <DropdownMenuItem 
                                onClick={() => updateApprovalStatus(property.id, 'approved')}
                                className="text-success"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {property.approval_status !== 'declined' && (
                              <DropdownMenuItem 
                                onClick={() => openRejectDialog(property)}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Decline
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          {filteredProperties.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{filteredProperties.length}</span> of <span className="font-medium text-foreground">{properties.length}</span> properties
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Last updated: just now
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Property Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <HomeIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Property Details</DialogTitle>
                <DialogDescription>
                  Complete information about this property
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedProperty && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Property Images */}
                {selectedProperty.images && selectedProperty.images.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Property Photos ({selectedProperty.images.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProperty.images.map((image, idx) => (
                        <button
                          key={idx}
                          onClick={() => openImageViewer(selectedProperty, idx)}
                          className="relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all group"
                        >
                          <img
                            src={image}
                            alt={`${selectedProperty.title} - ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Property Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <HomeIcon className="h-4 w-4 text-primary" />
                    Property Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Title</p>
                      <p className="font-medium">{selectedProperty.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Type</p>
                      <p className="font-medium capitalize">{selectedProperty.property_type || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Location</p>
                      <p className="font-medium">{selectedProperty.location_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Price</p>
                      <p className="font-medium">KES {selectedProperty.price_kes?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bedrooms</p>
                      <p className="font-medium">{selectedProperty.bedrooms || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bathrooms</p>
                      <p className="font-medium">{selectedProperty.bathrooms || 'N/A'}</p>
                    </div>
                    {selectedProperty.square_feet && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Square Feet</p>
                        <p className="font-medium">{selectedProperty.square_feet.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Landlord</p>
                      <p className="font-medium">{landlords[selectedProperty.landlord_id]?.full_name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                {selectedProperty.description && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold">Description</h3>
                      <p className="text-sm text-muted-foreground">{selectedProperty.description}</p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Status */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Approval Status</h3>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    {selectedProperty.approval_status === 'approved' && (
                      <Badge className="bg-success text-success-foreground">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    )}
                    {selectedProperty.approval_status === 'pending' && (
                      <Badge variant="outline" className="border-warning text-warning">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending Review
                      </Badge>
                    )}
                    {selectedProperty.approval_status === 'declined' && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Declined
                      </Badge>
                    )}
                  </div>
                  {selectedProperty.rejection_reason && (
                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                      <p className="text-sm text-destructive">{selectedProperty.rejection_reason}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Timeline
                  </h3>
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-muted-foreground">Listed:</span>
                      <span className="font-medium">
                        {new Date(selectedProperty.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            {selectedProperty?.approval_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    openRejectDialog(selectedProperty);
                  }}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={() => {
                    if (selectedProperty) {
                      updateApprovalStatus(selectedProperty.id, 'approved');
                      setViewDialogOpen(false);
                    }
                  }}
                  className="bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Property
                </Button>
              </>
            )}
            {selectedProperty?.approval_status !== 'pending' && (
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Property Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-xl">Decline Property</DialogTitle>
                <DialogDescription>
                  Please provide a reason for declining this property listing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter reason (e.g., inappropriate images, incorrect information, policy violation)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The landlord will be notified with this reason • {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectionReason.length > 500}
              className="bg-gradient-to-r from-destructive to-destructive/80"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-0 animate-scale-in">
          {selectedProperty?.images && selectedProperty.images.length > 0 && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setImageViewerOpen(false)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Image */}
              <div className="relative bg-black">
                <img
                  src={selectedProperty.images[selectedImageIndex]}
                  alt={`${selectedProperty.title} - ${selectedImageIndex + 1}`}
                  className="w-full h-[80vh] object-contain"
                />
              </div>

              {/* Navigation */}
              {selectedProperty.images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevImage}
                    disabled={selectedImageIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextImage}
                    disabled={selectedImageIndex === selectedProperty.images.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image Counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                {selectedImageIndex + 1} / {selectedProperty.images.length}
              </div>

              {/* Thumbnails */}
              <div className="p-4 bg-black/50 backdrop-blur-sm">
                <div className="flex gap-2 overflow-x-auto">
                  {selectedProperty.images.map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === selectedImageIndex
                          ? 'border-primary scale-110'
                          : 'border-white/20 hover:border-white/50'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
