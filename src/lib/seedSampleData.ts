// src/lib/seedSampleData.ts
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Project, ProjectPhase } from '@/types';

export async function seedSampleProjects(userId: string) {
  const sample1Phases: ProjectPhase[] = [
    { id: 'p1', name: 'Design Consultation & 3D Render', status: 'completed', notes: 'Design approved by client.' },
    { id: 'p2', name: 'Permits & Underground Utilities Check', status: 'completed', notes: 'Call-before-you-dig complete.' },
    { id: 'p3', name: 'Paver Patio & Outdoor Kitchen', status: 'active', notes: 'Laying natural bluestone pavers.' },
    { id: 'p4', name: 'Planting, Sod & Irrigation', status: 'pending', notes: 'Boxwoods, hydrangeas, and drip system.' },
    { id: 'p5', name: 'Low-Voltage Lighting & Handover', status: 'pending', notes: 'Pathway lights and final walkthrough.' },
  ];

  const project1Ref = await addDoc(collection(db, 'projects'), {
    title: 'Palm Jumeirah Villa — Travertine Patio & Zen Water Garden',
    address: 'Frond E, Palm Jumeirah, Dubai',
    budget: 125000,
    description: 'Luxury outdoor living space with natural travertine tile, custom shade pergola, climate-adapted palms, infinity water feature, and smart automated irrigation.',
    coverPhoto: 'https://images.unsplash.com/photo-1584463699026-643c7b3992ea?auto=format&fit=crop&w=1000&q=80',
    status: 'in_progress',
    phases: sample1Phases,
    clientId: userId,
    pmId: userId,
    crewIds: [],
    tags: ['Patio', 'Pergola', 'Water Feature', 'Irrigation'],
    startDate: new Date(Date.now() - 14 * 86400000).toISOString(),
    estimatedEndDate: new Date(Date.now() + 21 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const sample2Phases: ProjectPhase[] = [
    { id: 'p1', name: 'Site Evaluation & Soil Analysis', status: 'completed', notes: 'Soil salinity and drainage checked.' },
    { id: 'p2', name: '3D Mockup & Lighting Scheme Approval', status: 'active', notes: 'Draft v2 sent to homeowner.' },
    { id: 'p3', name: 'Retaining Wall & Drainage', status: 'pending', notes: 'Structural block and weeping tile installation.' },
    { id: 'p4', name: 'Desert Flora & Olive Trees', status: 'pending', notes: 'Specimen olive tree focal point.' },
  ];

  const project2Ref = await addDoc(collection(db, 'projects'), {
    title: 'Al Barari Residence — Desert Modern Courtyard',
    address: 'Jasmine Leaf 3, Al Barari, Dubai',
    budget: 85000,
    description: 'Modern minimalist courtyard with architectural succulents, architectural LED step lights, mature olive tree, and decomposed granite pathway.',
    coverPhoto: 'https://images.unsplash.com/photo-1558904541-efa8c4a08931?auto=format&fit=crop&w=1000&q=80',
    status: 'approval',
    phases: sample2Phases,
    clientId: userId,
    pmId: userId,
    crewIds: [],
    tags: ['Courtyard', 'Lighting', 'Desert Flora'],
    startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    estimatedEndDate: new Date(Date.now() + 35 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Seed sample design mockups for project 1
  await addDoc(collection(db, 'designs'), {
    projectId: project1Ref.id,
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
    title: '3D Backyard Master Plan (v2)',
    version: 2,
    status: 'pending',
    annotations: [],
    uploadedBy: 'Project Lead Marcus',
    uploadedAt: new Date().toISOString(),
  });

  // Seed sample invoice
  await addDoc(collection(db, 'invoices'), {
    projectId: project1Ref.id,
    clientId: userId,
    invoiceNumber: 'INV-2024-001',
    lineItems: [
      { description: 'Phase 1 & 2 Deposit & Site Survey', quantity: 1, unitPrice: 35000 },
      { description: 'Natural Travertine Paver Materials', quantity: 1, unitPrice: 18000 },
    ],
    amount: 53000,
    status: 'sent',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  });

  // Seed sample message
  await addDoc(collection(db, `projects/${project1Ref.id}/messages`), {
    senderId: 'pm-marcus',
    senderName: 'Marcus (Project Lead)',
    text: 'Good morning! The bluestone pavers have arrived on site and the crew is prepping the bedding layer today. Check the design tab for the updated layout!',
    createdAt: new Date().toISOString(),
    readBy: [],
  });

  return { project1Id: project1Ref.id, project2Id: project2Ref.id };
}
