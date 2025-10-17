import React from 'react'
import Home from './components/Home'
import 'bootstrap/dist/css/bootstrap.min.css';
import DailyDeliveries from './components/DailyDeliveries';
import DailyEntry from './components/DailyEntry';
import ProductForm from './components/DailyMilkDeliveryForm'
import AddNewCustomerForm from './components/AddNewCustomerForm';
import { Route, Routes } from 'react-router-dom';
import AddNewAgentForm from './components/AddNewAgentForm';
import DairyCustomerDashboard from './components/DairyCustomerDashboard';

function App() {
  return (
    <Routes>
      
      <Route path='/' element={<DailyDeliveries> </DailyDeliveries>}></Route>
      <Route path='/addCustomer' element={<AddNewCustomerForm></AddNewCustomerForm>}></Route>
      <Route path='/addAgent' element={<AddNewAgentForm></AddNewAgentForm>}></Route>
      <Route path='/customerDashbord' element={<DairyCustomerDashboard></DairyCustomerDashboard>}></Route>

    </Routes>
   
)
}

export default App